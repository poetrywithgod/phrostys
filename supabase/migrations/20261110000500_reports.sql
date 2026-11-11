-- ============================================================================
-- Reports (owner only): profit, rankings and best buyer per product.
-- One call returns everything the Reports page draws. Runs as the caller, so
-- row-level security still applies, and it refuses anyone who is not the owner.
-- ============================================================================

create function public.reports_overview(
  p_from timestamptz,
  p_to   timestamptz
) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  v_totals jsonb;
  v_products jsonb;
  v_categories jsonb;
  v_channels jsonb;
  v_customers jsonb;
  v_slow jsonb;
  v_stock_value numeric;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can open reports' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'revenue',  coalesce(sum(revenue), 0),
           'cost',     coalesce(sum(cost), 0),
           'profit',   coalesce(sum(profit), 0),
           'units',    coalesce(sum(quantity), 0),
           'orders',   count(distinct sale_id)
         )
    into v_totals
    from public.v_profit_lines
   where sold_at >= p_from and sold_at < p_to;

  -- Every product that sold, with its best buyer (the named customer who took the most of it).
  select coalesce(jsonb_agg(t order by t.revenue desc), '[]'::jsonb) into v_products from (
    select pl.product_id, p.name, p.unit, c.name as category,
           sum(pl.quantity) as quantity, sum(pl.revenue) as revenue,
           sum(pl.cost) as cost, sum(pl.profit) as profit,
           b.full_name as best_buyer, b.quantity as best_buyer_quantity
      from public.v_profit_lines pl
      join public.products p on p.id = pl.product_id
      left join public.categories c on c.id = p.category_id
      left join lateral (
        select cu.full_name, sum(x.quantity) as quantity
          from public.v_profit_lines x
          join public.customers cu on cu.id = x.customer_id
         where x.product_id = pl.product_id and x.sold_at >= p_from and x.sold_at < p_to
         group by cu.id, cu.full_name
         order by sum(x.quantity) desc, cu.full_name
         limit 1
      ) b on true
     where pl.sold_at >= p_from and pl.sold_at < p_to
     group by pl.product_id, p.name, p.unit, c.name, b.full_name, b.quantity
  ) t;

  select coalesce(jsonb_agg(t order by t.revenue desc), '[]'::jsonb) into v_categories from (
    select coalesce(c.name, 'No category') as name,
           sum(pl.revenue) as revenue, sum(pl.profit) as profit
      from public.v_profit_lines pl
      join public.products p on p.id = pl.product_id
      left join public.categories c on c.id = p.category_id
     where pl.sold_at >= p_from and pl.sold_at < p_to
     group by coalesce(c.name, 'No category')
  ) t;

  select coalesce(jsonb_agg(t order by t.revenue desc), '[]'::jsonb) into v_channels from (
    select channel::text as channel, sum(revenue) as revenue, sum(profit) as profit
      from public.v_profit_lines
     where sold_at >= p_from and sold_at < p_to
     group by channel
  ) t;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_customers from (
    select cu.id as customer_id, cu.full_name,
           count(distinct pl.sale_id) as orders, sum(pl.revenue) as spent, sum(pl.profit) as profit
      from public.v_profit_lines pl
      join public.customers cu on cu.id = pl.customer_id
     where pl.sold_at >= p_from and pl.sold_at < p_to
     group by cu.id, cu.full_name
     order by sum(pl.revenue) desc
     limit 10
  ) t;

  -- Products sitting on the shelf that did not sell in this period (money tied up).
  select coalesce(jsonb_agg(t order by t.stock_value desc nulls last), '[]'::jsonb) into v_slow from (
    select p.id as product_id, p.name, p.unit,
           sum(sl.quantity) as quantity,
           sum(sl.quantity * coalesce(sc.avg_cost, 0)) as stock_value
      from public.products p
      join public.stock_levels sl on sl.product_id = p.id and sl.quantity > 0
      left join public.stock_costing sc on sc.product_id = sl.product_id and sc.location_id = sl.location_id
     where not exists (
       select 1 from public.sale_items si join public.sales s on s.id = si.sale_id
        where si.product_id = p.id and s.sold_at >= p_from and s.sold_at < p_to)
     group by p.id, p.name, p.unit
     limit 8
  ) t;

  select coalesce(sum(sl.quantity * coalesce(sc.avg_cost, 0)), 0) into v_stock_value
    from public.stock_levels sl
    left join public.stock_costing sc on sc.product_id = sl.product_id and sc.location_id = sl.location_id;

  return jsonb_build_object(
    'totals', v_totals, 'products', v_products, 'categories', v_categories,
    'channels', v_channels, 'customers', v_customers, 'not_selling', v_slow,
    'stock_value', v_stock_value
  );
end $$;

revoke execute on function public.reports_overview(timestamptz, timestamptz) from public, anon;
grant  execute on function public.reports_overview(timestamptz, timestamptz) to authenticated;
