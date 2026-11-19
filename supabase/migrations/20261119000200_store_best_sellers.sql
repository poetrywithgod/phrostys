-- ============================================================================
-- Phase 2, step 2: "Best sellers" for the storefront home page.
--
-- Ranks online products by units sold in the last 90 days (all channels).
-- Only the ranking is public; no sales figures leave the database. Products
-- with no recent sales still appear after the ranked ones, in stock first.
-- Same safe columns as store_products().
-- ============================================================================

create function public.store_best_sellers(p_limit integer default 8)
returns table (
  id             uuid,
  name           text,
  unit           text,
  pack_size      numeric,
  retail_price   numeric,
  description    text,
  category_id    uuid,
  category_name  text,
  cover_path     text,
  in_stock       boolean,
  max_order      numeric,
  average_rating numeric,
  review_count   bigint
)
language sql stable security definer set search_path = '' as $$
  with sold as (
    select si.product_id, sum(si.quantity) as units
      from public.sale_items si
      join public.sales s on s.id = si.sale_id
     where s.sold_at >= now() - interval '90 days'
     group by si.product_id
  )
  select p.id, p.name, p.unit, p.pack_size, p.retail_price, p.description,
         p.category_id, c.name,
         (select i.path from public.product_images i
           where i.product_id = p.id order by i.sort_order, i.created_at limit 1),
         coalesce(st.qty, 0) > 0,
         least(greatest(coalesce(st.qty, 0), 0), 50),
         r.average_rating,
         coalesce(r.review_count, 0)
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join sold d on d.product_id = p.id
    left join lateral (
      select sum(sl.quantity) as qty
        from public.stock_levels sl
        join public.locations l on l.id = sl.location_id and l.is_active
       where sl.product_id = p.id
    ) st on true
    left join public.v_product_ratings r on r.product_id = p.id
   where p.is_active and p.show_online
   order by (coalesce(st.qty, 0) > 0) desc, coalesce(d.units, 0) desc, p.name
   limit least(greatest(p_limit, 1), 50);
$$;

revoke execute on function public.store_best_sellers(integer) from public;
grant  execute on function public.store_best_sellers(integer) to anon, authenticated;
