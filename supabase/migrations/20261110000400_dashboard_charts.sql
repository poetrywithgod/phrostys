-- ============================================================================
-- Dashboard charts: everything the dashboard draws, in one call.
--
-- Runs as the caller (security invoker), so row-level security still applies.
-- The sales-over-time series is zero-filled, so the chart draws a full axis
-- even before the first sale. Profit is owner-only: null for staff.
-- A period of one day or less is bucketed by hour, anything longer by day,
-- both in Lagos time.
-- ============================================================================

create function public.dashboard_charts(
  p_from timestamptz,
  p_to   timestamptz
) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v_step   interval := case when (p_to - p_from) <= interval '1 day' then interval '1 hour' else interval '1 day' end;
  v_unit   text := case when (p_to - p_from) <= interval '1 day' then 'hour' else 'day' end;
  v_start  timestamp := date_trunc(case when (p_to - p_from) <= interval '1 day' then 'hour' else 'day' end,
                                   p_from at time zone 'Africa/Lagos');
  v_end    timestamp := date_trunc(case when (p_to - p_from) <= interval '1 day' then 'hour' else 'day' end,
                                   (p_to - interval '1 second') at time zone 'Africa/Lagos');
  v_series jsonb;
  v_top_products jsonb;
  v_top_customers jsonb;
  v_recent jsonb;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  with buckets as (
    select generate_series(v_start, v_end, v_step) as k
  ),
  s as (
    select date_trunc(v_unit, sold_at at time zone 'Africa/Lagos') as k,
           sum(total) as revenue, count(*) as orders
      from public.sales
     where sold_at >= p_from and sold_at < p_to
     group by 1
  ),
  p as (
    select date_trunc(v_unit, sold_at at time zone 'Africa/Lagos') as k, sum(profit) as profit
      from public.v_profit_lines
     where sold_at >= p_from and sold_at < p_to
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'at',      to_char(b.k, 'YYYY-MM-DD"T"HH24:MI'),
           'revenue', coalesce(s.revenue, 0),
           'orders',  coalesce(s.orders, 0),
           'profit',  case when public.is_owner() then coalesce(p.profit, 0) end
         ) order by b.k), '[]'::jsonb)
    into v_series
    from buckets b
    left join s on s.k = b.k
    left join p on p.k = b.k;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_top_products from (
    select pr.id as product_id, pr.name, pr.unit,
           sum(si.quantity) as quantity, sum(si.line_total) as revenue
      from public.sale_items si
      join public.sales s     on s.id = si.sale_id
      join public.products pr on pr.id = si.product_id
     where s.sold_at >= p_from and s.sold_at < p_to
     group by pr.id, pr.name, pr.unit
     order by sum(si.line_total) desc
     limit 5
  ) t;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_top_customers from (
    select c.id as customer_id, c.full_name, count(*) as orders, sum(s.total) as spent
      from public.sales s
      join public.customers c on c.id = s.customer_id
     where s.sold_at >= p_from and s.sold_at < p_to
     group by c.id, c.full_name
     order by sum(s.total) desc
     limit 5
  ) t;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_recent from (
    select s.id, s.sale_number, s.sold_at, s.total, s.balance, s.payment_type,
           coalesce(c.full_name, 'Walk-in customer') as customer
      from public.sales s
      left join public.customers c on c.id = s.customer_id
     order by s.sold_at desc
     limit 6
  ) t;

  return jsonb_build_object(
    'unit',          v_unit,
    'series',        v_series,
    'top_products',  v_top_products,
    'top_customers', v_top_customers,
    'recent_sales',  v_recent
  );
end $$;

revoke execute on function public.dashboard_charts(timestamptz, timestamptz) from public, anon;
grant  execute on function public.dashboard_charts(timestamptz, timestamptz) to authenticated;
