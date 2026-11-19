-- ============================================================================
-- Phase 2, step 1: the public storefront catalogue.
--
-- Visitors (not signed in) may browse products, but must never see what an
-- item cost us, the exact stock figures, or inactive products. Instead of
-- opening the products table to the public, the storefront calls the three
-- small functions below. They run with the table owner's rights, return only
-- safe columns, and filter to active products the owner has chosen to show
-- online.
--
-- Stock is exposed only as "in stock or not" and an order cap of at most 50,
-- which the cart uses to stop people ordering more than exists. Checkout will
-- re-check real stock on the server.
-- ============================================================================

alter table public.products
  add column description text check (description is null or char_length(description) <= 2000),
  add column show_online boolean not null default true;

-- Products people can see online: active AND switched on for the website.
create index products_online_idx on public.products (category_id)
  where is_active and show_online;

-- ------------------------------------------------------------- categories ----
create function public.store_categories()
returns table (id uuid, name text, product_count bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, count(p.id) as product_count
    from public.categories c
    join public.products p
      on p.category_id = c.id and p.is_active and p.show_online
   group by c.id, c.name
   order by c.name;
$$;

-- --------------------------------------------------------------- products ----
-- One row per product for the shop grid. p_search matches name or description.
create function public.store_products(
  p_category uuid default null,
  p_search   text default null,
  p_limit    integer default 48,
  p_offset   integer default 0
)
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
  select p.id, p.name, p.unit, p.pack_size, p.retail_price, p.description,
         p.category_id, c.name,
         (select i.path from public.product_images i
           where i.product_id = p.id order by i.sort_order, i.created_at limit 1),
         coalesce(s.qty, 0) > 0,
         least(greatest(coalesce(s.qty, 0), 0), 50),
         r.average_rating,
         coalesce(r.review_count, 0)
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join lateral (
      select sum(sl.quantity) as qty
        from public.stock_levels sl
        join public.locations l on l.id = sl.location_id and l.is_active
       where sl.product_id = p.id
    ) s on true
    left join public.v_product_ratings r on r.product_id = p.id
   where p.is_active and p.show_online
     and (p_category is null or p.category_id = p_category)
     and (p_search is null or btrim(p_search) = ''
          or p.name ilike '%' || btrim(p_search) || '%'
          or coalesce(p.description, '') ilike '%' || btrim(p_search) || '%')
   order by (coalesce(s.qty, 0) > 0) desc, p.name
   limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

-- One product with its full photo gallery (cover first).
create function public.store_product(p_id uuid)
returns table (
  id             uuid,
  name           text,
  unit           text,
  pack_size      numeric,
  retail_price   numeric,
  description    text,
  category_id    uuid,
  category_name  text,
  image_paths    text[],
  in_stock       boolean,
  max_order      numeric,
  average_rating numeric,
  review_count   bigint
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.unit, p.pack_size, p.retail_price, p.description,
         p.category_id, c.name,
         coalesce((select array_agg(i.path order by i.sort_order, i.created_at)
                     from public.product_images i where i.product_id = p.id), '{}'),
         coalesce(s.qty, 0) > 0,
         least(greatest(coalesce(s.qty, 0), 0), 50),
         r.average_rating,
         coalesce(r.review_count, 0)
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join lateral (
      select sum(sl.quantity) as qty
        from public.stock_levels sl
        join public.locations l on l.id = sl.location_id and l.is_active
       where sl.product_id = p.id
    ) s on true
    left join public.v_product_ratings r on r.product_id = p.id
   where p.id = p_id and p.is_active and p.show_online;
$$;

revoke execute on function public.store_categories()                              from public;
revoke execute on function public.store_products(uuid, text, integer, integer)    from public;
revoke execute on function public.store_product(uuid)                             from public;
grant  execute on function public.store_categories()                              to anon, authenticated;
grant  execute on function public.store_products(uuid, text, integer, integer)    to anon, authenticated;
grant  execute on function public.store_product(uuid)                             to anon, authenticated;
