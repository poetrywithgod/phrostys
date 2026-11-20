-- ============================================================================
-- Phase 2, step 3: online orders.
--
-- Rules this migration enforces:
--   * Customers never write to the orders tables directly. They call
--     place_order(), which looks up real prices and stock itself, so a
--     tampered browser cannot change what an order costs.
--   * Customers can read one order only by knowing BOTH its order number and
--     the email on it (track_order). Staff see everything.
--   * Delivery fees and rules live in a single settings row the owner can edit.
--
-- Stock is NOT reduced here. When staff fulfil an order (admin Orders screen,
-- next step) it becomes a normal sale, so reports and stock stay correct.
-- Until then an order only checks that enough stock exists when it is placed.
--
-- The settings values below are PLACEHOLDERS taken from the design mock-ups.
-- Change them in the table editor (store_settings) before going live.
-- ============================================================================

-- ------------------------------------------------------------------ settings
create table public.store_settings (
  id                      boolean primary key default true check (id),  -- exactly one row
  local_cities            text[]        not null default array['Port Harcourt'],
  local_delivery_fee      numeric(14,2) not null default 500  check (local_delivery_fee >= 0),
  outside_delivery_fee    numeric(14,2) not null default 1500 check (outside_delivery_fee >= 0),
  free_delivery_threshold numeric(14,2) default 100000 check (free_delivery_threshold is null or free_delivery_threshold >= 0),
  pickup_enabled          boolean       not null default true,
  pickup_address          text,
  pay_on_delivery_enabled boolean       not null default true,
  updated_at              timestamptz   not null default now()
);
insert into public.store_settings default values;

comment on table public.store_settings is
  'One row. local_cities get local_delivery_fee (free above free_delivery_threshold); anywhere else pays outside_delivery_fee. Pay on delivery is allowed only for local deliveries and pickup.';

alter table public.store_settings enable row level security;
create policy store_settings_staff_read on public.store_settings for select to authenticated
  using (public.is_staff());
create policy store_settings_owner_update on public.store_settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ------------------------------------------------------------------- orders
create sequence public.order_no_seq start 1001;

create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text not null unique
                   default ('PHR-' || lpad(nextval('public.order_no_seq')::text, 6, '0')),
  status         text not null default 'new'
                   check (status in ('new', 'preparing', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null default 'unpaid'
                   check (payment_status in ('unpaid', 'paid', 'failed')),
  payment_method text not null
                   check (payment_method in ('card', 'bank_transfer', 'pay_on_delivery')),
  fulfilment     text not null check (fulfilment in ('delivery', 'pickup')),

  first_name     text not null check (char_length(first_name) between 1 and 80),
  last_name      text not null check (char_length(last_name)  between 1 and 80),
  email          text not null check (char_length(email) between 5 and 160),
  phone          text not null check (char_length(phone) between 7 and 24),
  address        text check (char_length(address) <= 300),
  city           text check (char_length(city) <= 100),
  state          text check (char_length(state) <= 100),
  delivery_location text check (char_length(delivery_location) <= 300),
  note           text check (char_length(note) <= 1000),

  subtotal       numeric(14,2) not null check (subtotal >= 0),
  delivery_fee   numeric(14,2) not null check (delivery_fee >= 0),
  total          numeric(14,2) not null check (total >= 0),

  payment_reference text unique,          -- Paystack reference of the latest attempt
  paid_at        timestamptz,
  preparing_at   timestamptz,
  shipped_at     timestamptz,
  delivered_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index orders_created_idx on public.orders (created_at desc);
create index orders_status_idx  on public.orders (status, payment_status);
create index orders_email_idx   on public.orders (lower(email));

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete restrict,
  product_name text not null,            -- copied, so old orders keep their wording
  unit         text not null,
  unit_price   numeric(14,2) not null check (unit_price >= 0),
  quantity     integer not null check (quantity between 1 and 50),
  line_total   numeric(14,2) not null check (line_total >= 0)
);
create index order_items_order_idx on public.order_items (order_id);

-- Stamp the time each stage is reached, so the customer's tracker has dates.
create function public.orders_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status = 'preparing' and new.preparing_at is null then new.preparing_at := now(); end if;
    if new.status = 'shipped'   and new.shipped_at   is null then new.shipped_at   := now(); end if;
    if new.status = 'delivered' and new.delivered_at is null then new.delivered_at := now(); end if;
  end if;
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' and new.paid_at is null then
    new.paid_at := now();
  end if;
  return new;
end $$;

create trigger orders_stamp before update on public.orders
  for each row execute function public.orders_stamp();

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

create policy orders_staff_read   on public.orders      for select to authenticated using (public.is_staff());
create policy orders_staff_update on public.orders      for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy order_items_staff_read on public.order_items for select to authenticated using (public.is_staff());

-- -------------------------------------------- public: delivery rules for UI
create function public.store_settings_public()
returns table (
  local_cities            text[],
  local_delivery_fee      numeric,
  outside_delivery_fee    numeric,
  free_delivery_threshold numeric,
  pickup_enabled          boolean,
  pickup_address          text,
  pay_on_delivery_enabled boolean
)
language sql stable security definer set search_path = '' as $$
  select local_cities, local_delivery_fee, outside_delivery_fee, free_delivery_threshold,
         pickup_enabled, pickup_address, pay_on_delivery_enabled
    from public.store_settings;
$$;

-- ------------------------------------------------------------- place_order
-- Input (jsonb): {
--   items: [{product_id, qty}], fulfilment, payment_method,
--   first_name, last_name, email, phone,
--   address, city, state, delivery_location, note }
-- Errors are raised as short codes the website turns into friendly messages:
--   invalid_order, empty_cart, product_unavailable:<name>, out_of_stock:<name>,
--   pickup_unavailable, pay_on_delivery_unavailable
create function public.place_order(p_order jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s            public.store_settings%rowtype;
  v_fulfil     text := p_order->>'fulfilment';
  v_method     text := p_order->>'payment_method';
  v_first      text := nullif(btrim(p_order->>'first_name'), '');
  v_last       text := nullif(btrim(p_order->>'last_name'), '');
  v_email      text := lower(nullif(btrim(p_order->>'email'), ''));
  v_phone      text := nullif(btrim(p_order->>'phone'), '');
  v_address    text := nullif(btrim(p_order->>'address'), '');
  v_city       text := nullif(btrim(p_order->>'city'), '');
  v_state      text := nullif(btrim(p_order->>'state'), '');
  v_location   text := nullif(btrim(p_order->>'delivery_location'), '');
  v_note       text := nullif(btrim(p_order->>'note'), '');
  v_items      jsonb := p_order->'items';
  v_lines      jsonb;
  v_local      boolean := false;
  v_subtotal   numeric(14,2) := 0;
  v_fee        numeric(14,2) := 0;
  v_order      public.orders%rowtype;
  r            record;
  v_stock      numeric;
begin
  if v_fulfil not in ('delivery', 'pickup')
     or v_method not in ('card', 'bank_transfer', 'pay_on_delivery')
     or v_first is null or v_last is null or v_email is null or v_phone is null
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or char_length(regexp_replace(v_phone, '\D', '', 'g')) not between 10 and 15
     or (v_fulfil = 'delivery' and (v_address is null or v_city is null or v_state is null))
     or v_items is null or jsonb_typeof(v_items) <> 'array' then
    raise exception 'invalid_order';
  end if;
  if jsonb_array_length(v_items) = 0 or jsonb_array_length(v_items) > 60 then
    raise exception 'empty_cart';
  end if;

  select * into s from public.store_settings;

  if v_fulfil = 'pickup' and not s.pickup_enabled then
    raise exception 'pickup_unavailable';
  end if;

  if v_fulfil = 'delivery' then
    v_local := exists (
      select 1 from unnest(s.local_cities) c where lower(btrim(c)) = lower(v_city)
    );
  end if;

  if v_method = 'pay_on_delivery'
     and (not s.pay_on_delivery_enabled or (v_fulfil = 'delivery' and not v_local)) then
    raise exception 'pay_on_delivery_unavailable';
  end if;

  -- Price every line from the database. Duplicate product lines are merged.
  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', l.product_id, 'name', l.name, 'unit', l.unit,
           'unit_price', l.unit_price, 'qty', l.qty)), '[]'::jsonb)
    into v_lines
    from (select p.id as product_id, p.name, p.unit, p.retail_price as unit_price,
                 sum(least(greatest((i->>'qty')::integer, 1), 50))::integer as qty
            from jsonb_array_elements(v_items) i
            join public.products p on p.id = (i->>'product_id')::uuid
           where p.is_active and p.show_online
           group by p.id, p.name, p.unit, p.retail_price) l;

  if jsonb_array_length(v_lines) <> (
       select count(distinct i->>'product_id') from jsonb_array_elements(v_items) i) then
    raise exception 'product_unavailable:%',
      coalesce((select p.name from jsonb_array_elements(v_items) i
                  join public.products p on p.id = (i->>'product_id')::uuid
                 where not (p.is_active and p.show_online) limit 1), 'an item');
  end if;

  for r in
    select (e->>'product_id')::uuid as product_id, e->>'name' as name,
           (e->>'unit_price')::numeric as unit_price, (e->>'qty')::integer as qty
      from jsonb_array_elements(v_lines) e
  loop
    select coalesce(sum(sl.quantity), 0) into v_stock
      from public.stock_levels sl
      join public.locations l on l.id = sl.location_id and l.is_active
     where sl.product_id = r.product_id;
    if v_stock < r.qty then
      raise exception 'out_of_stock:%', r.name;
    end if;
    v_subtotal := v_subtotal + r.unit_price * r.qty;
  end loop;

  if v_fulfil = 'delivery' then
    if v_local then
      v_fee := case when s.free_delivery_threshold is not null and v_subtotal >= s.free_delivery_threshold
                    then 0 else s.local_delivery_fee end;
    else
      v_fee := s.outside_delivery_fee;
    end if;
  end if;

  insert into public.orders (
    payment_method, fulfilment, first_name, last_name, email, phone,
    address, city, state, delivery_location, note, subtotal, delivery_fee, total)
  values (
    v_method, v_fulfil, v_first, v_last, v_email, v_phone,
    v_address, v_city, v_state, v_location, v_note, v_subtotal, v_fee, v_subtotal + v_fee)
  returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name, unit, unit_price, quantity, line_total)
  select v_order.id, (e->>'product_id')::uuid, e->>'name', e->>'unit',
         (e->>'unit_price')::numeric, (e->>'qty')::integer,
         (e->>'unit_price')::numeric * (e->>'qty')::integer
    from jsonb_array_elements(v_lines) e;

  return jsonb_build_object(
    'order_id', v_order.id, 'order_no', v_order.order_no, 'email', v_order.email,
    'subtotal', v_order.subtotal, 'delivery_fee', v_order.delivery_fee, 'total', v_order.total,
    'payment_method', v_order.payment_method, 'payment_status', v_order.payment_status);
end $$;

-- -------------------------------------------------------------- track_order
-- Returns one order (with items) only when order number AND email both match.
create function public.track_order(p_order_no text, p_email text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'payment_status', o.payment_status,
    'payment_method', o.payment_method, 'fulfilment', o.fulfilment,
    'first_name', o.first_name, 'last_name', o.last_name,
    'address', o.address, 'city', o.city, 'state', o.state,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'total', o.total,
    'created_at', o.created_at, 'paid_at', o.paid_at, 'preparing_at', o.preparing_at,
    'shipped_at', o.shipped_at, 'delivered_at', o.delivered_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_id', i.product_id, 'name', i.product_name, 'unit', i.unit,
               'unit_price', i.unit_price, 'quantity', i.quantity, 'line_total', i.line_total,
               'image_path', (select pi.path from public.product_images pi
                               where pi.product_id = i.product_id
                               order by pi.sort_order, pi.created_at limit 1))
             order by i.product_name)
        from public.order_items i where i.order_id = o.id), '[]'::jsonb))
  from public.orders o
  where o.order_no = upper(btrim(p_order_no)) and lower(o.email) = lower(btrim(p_email));
$$;

revoke execute on function public.store_settings_public()   from public;
revoke execute on function public.place_order(jsonb)        from public;
revoke execute on function public.track_order(text, text)   from public;
grant  execute on function public.store_settings_public()   to anon, authenticated;
grant  execute on function public.place_order(jsonb)        to anon, authenticated;
grant  execute on function public.track_order(text, text)   to anon, authenticated;
