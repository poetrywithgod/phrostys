-- Several pickup points instead of one pickup address.
-- pickup_address becomes a list (text[]). A pickup order must name one of the points,
-- which is stored in orders.delivery_location.

do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'store_settings' and column_name = 'pickup_address') = 'text' then
    alter table public.store_settings
      alter column pickup_address type text[]
      using case when pickup_address is null then array[]::text[] else array[pickup_address] end;
  end if;
end $$;

alter table public.store_settings alter column pickup_address set default array[]::text[];
update public.store_settings set pickup_address = array[]::text[] where pickup_address is null;
alter table public.store_settings alter column pickup_address set not null;

comment on column public.store_settings.pickup_address is 'List of pickup points customers can choose from.';

drop function if exists public.store_settings_public();
create function public.store_settings_public()
returns table (
  local_cities            text[],
  local_delivery_fee      numeric,
  outside_delivery_fee    numeric,
  free_delivery_threshold numeric,
  pickup_enabled          boolean,
  pickup_address          text[],
  pay_on_delivery_enabled boolean
)
language sql stable security definer set search_path = '' as $$
  select local_cities, local_delivery_fee, outside_delivery_fee, free_delivery_threshold,
         pickup_enabled, pickup_address, pay_on_delivery_enabled
    from public.store_settings;
$$;

create or replace function public.place_order(p_order jsonb)
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
  -- Pickup orders must name one of the shop's pickup points (kept in delivery_location).
  if v_fulfil = 'pickup' and (v_location is null or not (v_location = any(s.pickup_address))) then
    raise exception 'invalid_pickup_point';
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

create or replace function public.track_order(p_order_no text, p_email text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'payment_status', o.payment_status,
    'payment_method', o.payment_method, 'fulfilment', o.fulfilment,
    'first_name', o.first_name, 'last_name', o.last_name,
    'address', o.address, 'city', o.city, 'state', o.state, 'delivery_location', o.delivery_location,
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
