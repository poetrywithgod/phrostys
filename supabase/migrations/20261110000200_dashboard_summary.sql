-- ============================================================================
-- Dashboard summary: the headline numbers for a period, in one call.
--
-- Runs as the caller (security invoker), so row-level security still applies.
-- Profit is returned only to the owner; for staff it is null.
-- ============================================================================

create function public.dashboard_summary(
  p_from timestamptz,
  p_to   timestamptz default now()
) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'sales_total',     coalesce((select sum(total) from public.sales
                                  where sold_at >= p_from and sold_at <= p_to), 0),
    'order_count',     (select count(*) from public.sales
                         where sold_at >= p_from and sold_at <= p_to),
    'profit',          case when public.is_owner()
                            then coalesce((select sum(profit) from public.v_profit_lines
                                            where sold_at >= p_from and sold_at <= p_to), 0)
                       end,
    'debtors_total',   coalesce((select sum(total_owed) from public.v_debtors), 0),
    'debtors_count',   (select count(*) from public.v_debtors),
    'low_stock_count', (select count(distinct product_id) from public.v_stock_status
                         where is_low and is_active),
    'customer_count',  (select count(*) from public.customers)
  );
end $$;

revoke execute on function public.dashboard_summary(timestamptz, timestamptz) from public, anon;
grant  execute on function public.dashboard_summary(timestamptz, timestamptz) to authenticated;
