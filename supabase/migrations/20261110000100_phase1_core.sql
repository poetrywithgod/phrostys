-- ============================================================================
-- Phrostys Phase 1 core schema
--
-- One business, built multi-location-ready (every stock and sales record
-- carries a location_id). Money is Naira, numeric(14,2). Quantities are
-- numeric(14,3) so kg-style units work.
--
-- Write model: staff NEVER insert into stock, purchase or sales tables
-- directly. They call the functions at the bottom (record_purchase,
-- record_sale, record_sale_payment, adjust_stock). That keeps stock, cost
-- and debtor figures consistent and is why those tables have no write
-- policies.
--
-- Cost privacy: what an item cost us (sale_item_costs, stock_costing,
-- stock_batches, audit_log) is readable by the owner only.
-- ============================================================================

-- ---------------------------------------------------------------- types ----
create type public.app_role       as enum ('owner', 'staff', 'rider', 'customer');
create type public.profit_method  as enum ('average', 'fifo');
create type public.sale_channel   as enum ('shop', 'website', 'phone_chat');
create type public.payment_type   as enum ('cash', 'transfer', 'credit');
create type public.payment_method as enum ('cash', 'transfer', 'card');
create type public.movement_type  as enum
  ('purchase', 'sale', 'adjustment', 'count_correction', 'opening_stock', 'return');

-- ------------------------------------------------------- generic helpers ----
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create function public.prevent_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only: rows cannot be changed or deleted', tg_table_name
    using errcode = '42501';
end $$;

-- ------------------------------------------------- locations & settings ----
create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.locations (name) values ('Main shop');

create table public.business_settings (
  id                      boolean primary key default true check (id),
  business_name           text not null default 'Phrostys',
  profit_method           public.profit_method not null default 'average',
  allow_negative_stock    boolean not null default false,
  regular_min_purchases   integer not null default 3  check (regular_min_purchases > 0),
  regular_window_days     integer not null default 90 check (regular_window_days > 0),
  lapse_days              integer not null default 30 check (lapse_days > 0),
  rhythm_multiplier       numeric(4,2) not null default 2 check (rhythm_multiplier > 1),
  reminder_cooldown_days  integer not null default 30 check (reminder_cooldown_days >= 0),
  updated_at              timestamptz not null default now(),
  updated_by              uuid
);
insert into public.business_settings default values;

-- --------------------------------------------------------------- profiles ----
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  phone       text,
  role        public.app_role not null default 'customer',
  is_active   boolean not null default true,
  location_id uuid references public.locations (id),
  created_at  timestamptz not null default now()
);

-- Role helpers. SECURITY DEFINER so they can read profiles regardless of RLS.
create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'owner', false)
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() in ('owner', 'staff'), false)
$$;

-- The very first account created becomes the owner; everyone after is a
-- customer until the owner promotes them (staff and riders are created by
-- the owner, never by self sign-up). Turn public sign-ups OFF in Supabase
-- while Phase 1 is the only thing live.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone,
    case when exists (select 1 from public.profiles where role = 'owner')
         then 'customer'::public.app_role
         else 'owner'::public.app_role end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- catalog ----
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  address    text,
  notes      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  sku             text unique,
  category_id     uuid references public.categories (id) on delete set null,
  supplier_id     uuid references public.suppliers (id) on delete set null,
  unit            text not null,                                  -- bag, carton, kg ...
  pack_size       numeric(14,3) not null default 1 check (pack_size > 0),
  reorder_level   numeric(14,3) not null default 0 check (reorder_level >= 0),
  retail_price    numeric(14,2) not null default 0 check (retail_price >= 0),
  wholesale_price numeric(14,2) check (wholesale_price >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index products_name_unit_pack_key
  on public.products (lower(name), unit, pack_size);
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------- customers ----
create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  phone        text,
  email        text,
  birthday     date,
  auth_user_id uuid unique references auth.users (id) on delete set null, -- Phase 2 website accounts
  opted_out    boolean not null default false,
  notes        text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create unique index customers_phone_key on public.customers (phone) where phone is not null;
create unique index customers_email_key on public.customers (lower(email)) where email is not null;

-- -------------------------------------------------------------- purchases ----
create table public.purchases (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references public.locations (id),
  supplier_id   uuid references public.suppliers (id),
  purchase_date date not null default current_date,
  reference     text,
  note          text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);

create table public.purchase_items (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete restrict,
  product_id  uuid not null references public.products (id),
  quantity    numeric(14,3) not null check (quantity > 0),
  unit_cost   numeric(14,2) not null check (unit_cost >= 0),
  line_total  numeric(14,2) generated always as (round(quantity * unit_cost, 2)) stored
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index purchase_items_product_idx  on public.purchase_items (product_id);

-- ------------------------------------------------------------------ stock ----
-- Append-only ledger of every change to stock.
create table public.stock_movements (
  id              bigint generated always as identity primary key,
  product_id      uuid not null references public.products (id),
  location_id     uuid not null references public.locations (id),
  movement_type   public.movement_type not null,
  quantity_change numeric(14,3) not null check (quantity_change <> 0),
  reason          text,
  ref_table       text,
  ref_id          uuid,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  constraint adjustments_need_reason check (
    movement_type not in ('adjustment', 'count_correction')
    or length(trim(coalesce(reason, ''))) > 0)
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create trigger stock_movements_append_only
  before update or delete on public.stock_movements
  for each row execute function public.prevent_change();

-- Current quantity (staff can read) ...
create table public.stock_levels (
  product_id  uuid not null references public.products (id),
  location_id uuid not null references public.locations (id),
  quantity    numeric(14,3) not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (product_id, location_id)
);

-- ... and what it cost us (owner only).
create table public.stock_costing (
  product_id  uuid not null references public.products (id),
  location_id uuid not null references public.locations (id),
  avg_cost    numeric(14,4) not null default 0,
  primary key (product_id, location_id)
);

-- Cost layers, kept up to date for BOTH profit methods so the owner can
-- switch method at any time without a rebuild.
create table public.stock_batches (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id),
  location_id   uuid not null references public.locations (id),
  source_table  text,
  source_id     uuid,
  received_at   timestamptz not null default now(),
  received_qty  numeric(14,3) not null check (received_qty > 0),
  remaining_qty numeric(14,3) not null check (remaining_qty >= 0),
  unit_cost     numeric(14,4) not null check (unit_cost >= 0)
);
create index stock_batches_open_idx
  on public.stock_batches (product_id, location_id, received_at, id)
  where remaining_qty > 0;

-- ------------------------------------------------------------------ sales ----
create table public.sales (
  id          uuid primary key default gen_random_uuid(),
  sale_number bigint generated always as identity,
  location_id uuid not null references public.locations (id),
  customer_id uuid references public.customers (id),            -- null = walk-in
  channel     public.sale_channel not null default 'shop',
  payment_type public.payment_type not null,
  sold_at     timestamptz not null default now(),
  total       numeric(14,2) not null default 0 check (total >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  balance     numeric(14,2) generated always as (total - amount_paid) stored,
  note        text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint credit_needs_customer check (payment_type <> 'credit' or customer_id is not null),
  constraint paid_not_over_total   check (amount_paid <= total)
);
create index sales_customer_idx on public.sales (customer_id, sold_at desc);
create index sales_sold_at_idx  on public.sales (sold_at desc);
create index sales_open_balance_idx on public.sales (customer_id) where balance > 0;

create table public.sale_items (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references public.sales (id) on delete restrict,
  product_id uuid not null references public.products (id),
  quantity   numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored
);
create index sale_items_sale_idx    on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

-- Cost of goods at the moment of sale, under the method in force THEN.
-- Changing the profit method later never rewrites history.
create table public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items (id) on delete restrict,
  unit_cost    numeric(14,4) not null check (unit_cost >= 0),
  method       public.profit_method not null
);

create table public.sale_payments (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales (id) on delete restrict,
  amount      numeric(14,2) not null check (amount > 0),
  method      public.payment_method not null,
  paid_at     timestamptz not null default now(),
  received_by uuid default auth.uid(),
  note        text
);
create index sale_payments_sale_idx on public.sale_payments (sale_id);

create function public.sync_sale_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.sales s
     set amount_paid = (select coalesce(sum(amount), 0) from public.sale_payments where sale_id = new.sale_id)
   where s.id = new.sale_id;
  return new;
end $$;
create trigger sale_payments_sync after insert on public.sale_payments
  for each row execute function public.sync_sale_paid();

-- --------------------------------------------------- messages & audit log ----
create table public.message_log (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  kind         text not null check (kind in ('reminder', 'birthday', 'order_update')),
  channel      text not null check (channel in ('sms', 'email')),
  body         text,
  status       text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_ref text,
  error        text,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create index message_log_customer_idx on public.message_log (customer_id, kind, created_at desc);

create table public.audit_log (
  id        bigint generated always as identity primary key,
  actor_id  uuid,
  action    text not null,
  table_name text not null,
  record_id text,
  old_data  jsonb,
  new_data  jsonb,
  at        timestamptz not null default now()
);
create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.prevent_change();

create function public.log_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log (actor_id, action, table_name, record_id, old_data)
    values (auth.uid(), tg_op, tg_table_name, to_jsonb(old) ->> 'id', to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(old) = to_jsonb(new) then return new; end if;
    insert into public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
    values (auth.uid(), tg_op, tg_table_name, to_jsonb(new) ->> 'id', to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_log (actor_id, action, table_name, record_id, new_data)
    values (auth.uid(), tg_op, tg_table_name, to_jsonb(new) ->> 'id', to_jsonb(new));
    return new;
  end if;
end $$;

create trigger products_audit after insert or update or delete on public.products
  for each row execute function public.log_row_change();
create trigger settings_audit after update on public.business_settings
  for each row execute function public.log_row_change();
create trigger profiles_audit after update or delete on public.profiles
  for each row execute function public.log_row_change();

-- ============================================================================
-- Stock engine (internal: not callable by clients)
-- ============================================================================

create function public.apply_receipt(
  p_product uuid, p_location uuid, p_qty numeric, p_unit_cost numeric,
  p_type public.movement_type, p_source_table text, p_source_id uuid,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_qty numeric;
  v_avg numeric;
  v_base numeric;
begin
  insert into public.stock_levels  (product_id, location_id) values (p_product, p_location) on conflict do nothing;
  insert into public.stock_costing (product_id, location_id) values (p_product, p_location) on conflict do nothing;

  select quantity into v_qty from public.stock_levels
   where product_id = p_product and location_id = p_location for update;
  select avg_cost into v_avg from public.stock_costing
   where product_id = p_product and location_id = p_location for update;

  v_base := greatest(v_qty, 0);
  update public.stock_costing
     set avg_cost = case when v_base + p_qty > 0
                         then (v_base * v_avg + p_qty * p_unit_cost) / (v_base + p_qty)
                         else p_unit_cost end
   where product_id = p_product and location_id = p_location;

  update public.stock_levels
     set quantity = quantity + p_qty, updated_at = now()
   where product_id = p_product and location_id = p_location;

  -- If stock had gone negative, the first units received cover the deficit.
  insert into public.stock_batches
    (product_id, location_id, source_table, source_id, received_qty, remaining_qty, unit_cost)
  values
    (p_product, p_location, p_source_table, p_source_id, p_qty,
     greatest(p_qty + least(v_qty, 0), 0), p_unit_cost);

  insert into public.stock_movements
    (product_id, location_id, movement_type, quantity_change, reason, ref_table, ref_id)
  values (p_product, p_location, p_type, p_qty, p_reason, p_source_table, p_source_id);
end $$;

create function public.consume_stock(
  p_product uuid, p_location uuid, p_qty numeric,
  p_type public.movement_type, p_source_table text, p_source_id uuid,
  p_reason text default null,
  out avg_unit_cost numeric, out fifo_unit_cost numeric
) returns record
language plpgsql security definer set search_path = public as $$
declare
  v_allow_negative boolean;
  v_qty   numeric;
  v_avg   numeric;
  v_need  numeric := p_qty;
  v_total numeric := 0;
  v_take  numeric;
  b       record;
begin
  select allow_negative_stock into v_allow_negative from public.business_settings;

  insert into public.stock_levels  (product_id, location_id) values (p_product, p_location) on conflict do nothing;
  insert into public.stock_costing (product_id, location_id) values (p_product, p_location) on conflict do nothing;

  select quantity into v_qty from public.stock_levels
   where product_id = p_product and location_id = p_location for update;
  select avg_cost into v_avg from public.stock_costing
   where product_id = p_product and location_id = p_location;

  if v_qty < p_qty and not v_allow_negative then
    raise exception 'Not enough stock: % available, % needed (product %)', v_qty, p_qty, p_product
      using errcode = 'P0001';
  end if;

  -- Always consume oldest batch first so FIFO layers stay accurate even
  -- while the owner is using average cost.
  for b in
    select id, remaining_qty, unit_cost
      from public.stock_batches
     where product_id = p_product and location_id = p_location and remaining_qty > 0
     order by received_at, id
     for update
  loop
    exit when v_need <= 0;
    v_take := least(b.remaining_qty, v_need);
    update public.stock_batches set remaining_qty = remaining_qty - v_take where id = b.id;
    v_total := v_total + v_take * b.unit_cost;
    v_need  := v_need - v_take;
  end loop;
  if v_need > 0 then
    v_total := v_total + v_need * v_avg;      -- uncovered units (negative stock) at average cost
  end if;

  update public.stock_levels
     set quantity = quantity - p_qty, updated_at = now()
   where product_id = p_product and location_id = p_location;

  insert into public.stock_movements
    (product_id, location_id, movement_type, quantity_change, reason, ref_table, ref_id)
  values (p_product, p_location, p_type, -p_qty, p_reason, p_source_table, p_source_id);

  avg_unit_cost  := v_avg;
  fifo_unit_cost := v_total / p_qty;
end $$;

-- ============================================================================
-- Functions the app calls
-- ============================================================================

-- p_items: [{"product_id": "...", "quantity": 5, "unit_cost": 20000}, ...]
create function public.record_purchase(
  p_location uuid, p_supplier uuid, p_date date, p_reference text, p_note text, p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_purchase uuid;
  v_item     record;
  v_item_id  uuid;
begin
  if not public.is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A purchase needs at least one item';
  end if;

  insert into public.purchases (location_id, supplier_id, purchase_date, reference, note)
  values (p_location, p_supplier, coalesce(p_date, current_date), p_reference, p_note)
  returning id into v_purchase;

  for v_item in
    select (e ->> 'product_id')::uuid   as product_id,
           (e ->> 'quantity')::numeric  as quantity,
           (e ->> 'unit_cost')::numeric as unit_cost
      from jsonb_array_elements(p_items) e
     order by 1                                   -- fixed lock order avoids deadlocks
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Quantity must be greater than zero';
    end if;
    if v_item.unit_cost is null or v_item.unit_cost < 0 then
      raise exception 'Cost is required for every item';
    end if;

    insert into public.purchase_items (purchase_id, product_id, quantity, unit_cost)
    values (v_purchase, v_item.product_id, v_item.quantity, v_item.unit_cost)
    returning id into v_item_id;

    perform public.apply_receipt(v_item.product_id, p_location, v_item.quantity, v_item.unit_cost,
                                 'purchase', 'purchase_items', v_item_id);
  end loop;

  return v_purchase;
end $$;

-- p_items:    [{"product_id": "...", "quantity": 2, "unit_price": 30000}, ...]  (unit_price optional = retail price)
-- p_payments: [{"amount": 10000, "method": "cash"}]  optional. Cash/transfer sales with no
--             payments listed are recorded as paid in full. Credit sales may carry a deposit.
create function public.record_sale(
  p_location uuid, p_customer uuid, p_channel public.sale_channel,
  p_payment_type public.payment_type, p_items jsonb,
  p_payments jsonb default '[]'::jsonb, p_note text default null,
  p_sold_at timestamptz default now()
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sale    uuid;
  v_method  public.profit_method;
  v_item    record;
  v_item_id uuid;
  v_avg     numeric;
  v_fifo    numeric;
  v_price   numeric;
  v_pay     record;
begin
  if not public.is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A sale needs at least one item';
  end if;

  select profit_method into v_method from public.business_settings;

  insert into public.sales (location_id, customer_id, channel, payment_type, sold_at, note)
  values (p_location, p_customer, p_channel, p_payment_type, coalesce(p_sold_at, now()), p_note)
  returning id into v_sale;

  for v_item in
    select (e ->> 'product_id')::uuid             as product_id,
           (e ->> 'quantity')::numeric            as quantity,
           nullif(e ->> 'unit_price', '')::numeric as unit_price
      from jsonb_array_elements(p_items) e
     order by 1
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Quantity must be greater than zero';
    end if;

    select coalesce(v_item.unit_price, retail_price) into v_price
      from public.products where id = v_item.product_id;
    if v_price is null then raise exception 'Unknown product %', v_item.product_id; end if;

    insert into public.sale_items (sale_id, product_id, quantity, unit_price)
    values (v_sale, v_item.product_id, v_item.quantity, v_price)
    returning id into v_item_id;

    select c.avg_unit_cost, c.fifo_unit_cost into v_avg, v_fifo
      from public.consume_stock(v_item.product_id, p_location, v_item.quantity,
                                'sale', 'sale_items', v_item_id) c;

    insert into public.sale_item_costs (sale_item_id, unit_cost, method)
    values (v_item_id, case when v_method = 'fifo' then v_fifo else v_avg end, v_method);
  end loop;

  update public.sales
     set total = (select coalesce(sum(line_total), 0) from public.sale_items where sale_id = v_sale)
   where id = v_sale;

  if p_payments is not null and jsonb_typeof(p_payments) = 'array' and jsonb_array_length(p_payments) > 0 then
    for v_pay in
      select (e ->> 'amount')::numeric as amount, (e ->> 'method')::public.payment_method as method
        from jsonb_array_elements(p_payments) e
    loop
      insert into public.sale_payments (sale_id, amount, method) values (v_sale, v_pay.amount, v_pay.method);
    end loop;
  elsif p_payment_type in ('cash', 'transfer') then
    insert into public.sale_payments (sale_id, amount, method)
    select id, total, p_payment_type::text::public.payment_method
      from public.sales where id = v_sale and total > 0;
  end if;

  if p_payment_type <> 'credit' and (select balance from public.sales where id = v_sale) > 0 then
    raise exception 'Cash and transfer sales must be paid in full. Use credit for part payment.';
  end if;

  return v_sale;
end $$;

create function public.record_sale_payment(
  p_sale uuid, p_amount numeric, p_method public.payment_method, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_balance numeric;
  v_id      uuid;
begin
  if not public.is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;

  select balance into v_balance from public.sales where id = p_sale for update;
  if v_balance is null then raise exception 'Sale not found'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if p_amount > v_balance then
    raise exception 'Payment of % is more than the balance owed (%)', p_amount, v_balance;
  end if;

  insert into public.sale_payments (sale_id, amount, method, note)
  values (p_sale, p_amount, p_method, p_note)
  returning id into v_id;
  return v_id;
end $$;

-- Damaged / expired / miscounted stock, stock-count corrections, opening stock.
-- p_delta is signed: negative removes stock, positive adds it.
create function public.adjust_stock(
  p_product uuid, p_location uuid, p_delta numeric,
  p_kind public.movement_type, p_reason text, p_unit_cost numeric default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_cost   numeric;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_kind not in ('adjustment', 'count_correction', 'opening_stock') then
    raise exception 'Use adjustment, count_correction or opening_stock';
  end if;
  if p_delta is null or p_delta = 0 then raise exception 'Nothing to adjust'; end if;
  if p_kind = 'opening_stock' then
    if p_delta < 0 then raise exception 'Opening stock must be positive'; end if;
    v_reason := coalesce(v_reason, 'Opening stock');
  elsif v_reason is null then
    raise exception 'A reason is required for every stock adjustment';
  end if;

  if p_delta > 0 then
    select coalesce(p_unit_cost, (select avg_cost from public.stock_costing
                                   where product_id = p_product and location_id = p_location), 0)
      into v_cost;
    perform public.apply_receipt(p_product, p_location, p_delta, v_cost, p_kind, null, null, v_reason);
  else
    perform public.consume_stock(p_product, p_location, -p_delta, p_kind, null, null, v_reason);
  end if;
end $$;

-- ============================================================================
-- Views (security_invoker: they obey the caller's row-level security)
-- ============================================================================

create view public.v_stock_status with (security_invoker = true) as
select p.id            as product_id,
       p.name, p.unit, p.pack_size, p.category_id, p.supplier_id,
       p.reorder_level, p.is_active,
       sl.location_id,
       coalesce(sl.quantity, 0) as quantity,
       (p.reorder_level > 0 and coalesce(sl.quantity, 0) <= p.reorder_level) as is_low
  from public.products p
  left join public.stock_levels sl on sl.product_id = p.id;

create view public.v_debtors with (security_invoker = true) as
select c.id as customer_id, c.full_name, c.phone,
       sum(s.balance)   as total_owed,
       min(s.sold_at)   as oldest_debt_at,
       count(*)         as open_sales
  from public.sales s
  join public.customers c on c.id = s.customer_id
 where s.balance > 0
 group by c.id, c.full_name, c.phone;

create view public.v_customer_stats with (security_invoker = true) as
with cfg as (select * from public.business_settings),
agg as (
  select s.customer_id,
         count(*)         as order_count,
         sum(s.total)     as total_spent,
         min(s.sold_at)   as first_purchase_at,
         max(s.sold_at)   as last_purchase_at,
         count(*) filter (where s.sold_at >= now() - make_interval(days => (select regular_window_days from cfg)))
                          as recent_orders
    from public.sales s
   where s.customer_id is not null
   group by s.customer_id
),
calc as (
  select c.id as customer_id, c.full_name, c.phone, c.email, c.birthday, c.opted_out,
         coalesce(a.order_count, 0)  as order_count,
         coalesce(a.total_spent, 0)  as total_spent,
         a.last_purchase_at,
         case when a.order_count > 1
              then (extract(epoch from (a.last_purchase_at - a.first_purchase_at)) / 86400.0) / (a.order_count - 1)
         end as avg_gap_days,
         case when a.last_purchase_at is not null
              then extract(epoch from (now() - a.last_purchase_at)) / 86400.0
         end as days_since_last,
         coalesce(a.recent_orders, 0) >= (select regular_min_purchases from cfg) as is_regular
    from public.customers c
    left join agg a on a.customer_id = c.id
)
select calc.*,
       -- A regular who has gone quiet: a month of silence, or far longer than their own usual gap.
       (calc.is_regular and calc.days_since_last is not null and (
          calc.days_since_last >= (select lapse_days from cfg)
          or (calc.avg_gap_days > 0
              and calc.days_since_last >= greatest((select rhythm_multiplier from cfg) * calc.avg_gap_days, 7))
       )) as is_lapsing
  from calc;

-- One row per sold line with revenue, cost and profit. Owner-only in effect
-- (the cost table is owner-readable, so staff get no rows).
create view public.v_profit_lines with (security_invoker = true) as
select s.id as sale_id, s.sold_at, s.channel, s.location_id, s.customer_id,
       (s.sold_at at time zone 'Africa/Lagos')::date as sale_day,
       si.product_id, si.quantity,
       si.line_total                            as revenue,
       round(si.quantity * sic.unit_cost, 2)    as cost,
       si.line_total - round(si.quantity * sic.unit_cost, 2) as profit,
       sic.method
  from public.sale_items si
  join public.sales s            on s.id = si.sale_id
  join public.sale_item_costs sic on sic.sale_item_id = si.id;

-- ============================================================================
-- Row-level security
-- ============================================================================
alter table public.locations         enable row level security;
alter table public.business_settings enable row level security;
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.suppliers         enable row level security;
alter table public.products          enable row level security;
alter table public.customers         enable row level security;
alter table public.purchases         enable row level security;
alter table public.purchase_items    enable row level security;
alter table public.stock_movements   enable row level security;
alter table public.stock_levels      enable row level security;
alter table public.stock_costing     enable row level security;
alter table public.stock_batches     enable row level security;
alter table public.sales             enable row level security;
alter table public.sale_items        enable row level security;
alter table public.sale_item_costs   enable row level security;
alter table public.sale_payments     enable row level security;
alter table public.message_log       enable row level security;
alter table public.audit_log         enable row level security;

-- Staff and owner can read the working data.
create policy staff_read on public.locations       for select to authenticated using (public.is_staff());
create policy staff_read on public.business_settings for select to authenticated using (public.is_staff());
create policy staff_read on public.categories      for select to authenticated using (public.is_staff());
create policy staff_read on public.suppliers       for select to authenticated using (public.is_staff());
create policy staff_read on public.products        for select to authenticated using (public.is_staff());
create policy staff_read on public.customers       for select to authenticated using (public.is_staff());
create policy staff_read on public.purchases       for select to authenticated using (public.is_staff());
create policy staff_read on public.purchase_items  for select to authenticated using (public.is_staff());
create policy staff_read on public.stock_movements for select to authenticated using (public.is_staff());
create policy staff_read on public.stock_levels    for select to authenticated using (public.is_staff());
create policy staff_read on public.sales           for select to authenticated using (public.is_staff());
create policy staff_read on public.sale_items      for select to authenticated using (public.is_staff());
create policy staff_read on public.sale_payments   for select to authenticated using (public.is_staff());
create policy staff_read on public.message_log     for select to authenticated using (public.is_staff());

-- Owner-only reads: costs and the audit trail.
create policy owner_read on public.stock_costing   for select to authenticated using (public.is_owner());
create policy owner_read on public.stock_batches   for select to authenticated using (public.is_owner());
create policy owner_read on public.sale_item_costs for select to authenticated using (public.is_owner());
create policy owner_read on public.audit_log       for select to authenticated using (public.is_owner());

-- Profiles: everyone sees their own; staff see the team; only the owner edits.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_owner_update on public.profiles for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Owner manages the catalogue, settings and locations (as the PRD describes).
create policy owner_write on public.locations   for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy owner_write on public.categories  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy owner_write on public.suppliers   for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy owner_write on public.products    for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy owner_update on public.business_settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Staff add and edit customers; only the owner deletes them.
create policy staff_insert on public.customers for insert to authenticated with check (public.is_staff());
create policy staff_update on public.customers for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy owner_delete on public.customers for delete to authenticated using (public.is_owner());

-- ------------------------------------------------------------------ grants ----
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Ledger and transaction tables are written only by the functions above.
revoke insert, update, delete, truncate on
  public.purchases, public.purchase_items, public.stock_movements, public.stock_levels,
  public.stock_costing, public.stock_batches, public.sales, public.sale_items,
  public.sale_item_costs, public.sale_payments, public.message_log, public.audit_log
  from authenticated;
revoke truncate on all tables in schema public from authenticated;
revoke insert, delete, truncate on public.business_settings, public.profiles from authenticated;

grant select on public.v_stock_status, public.v_debtors, public.v_customer_stats, public.v_profit_lines
  to authenticated;

-- Functions: closed by default, then opened only where the app needs them.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.current_app_role(), public.is_owner(), public.is_staff(),
  public.record_purchase(uuid, uuid, date, text, text, jsonb),
  public.record_sale(uuid, uuid, public.sale_channel, public.payment_type, jsonb, jsonb, text, timestamptz),
  public.record_sale_payment(uuid, numeric, public.payment_method, text),
  public.adjust_stock(uuid, uuid, numeric, public.movement_type, text, numeric)
  to authenticated;
