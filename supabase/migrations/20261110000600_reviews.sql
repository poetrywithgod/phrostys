-- ============================================================================
-- Customer reviews: customers write them, staff approve them.
--
-- A review is invisible to the public until staff approve it. Customers can
-- only create reviews (always "pending") and read their own. Everything staff
-- do goes through moderate_review(), so nobody edits a review's text or rating
-- after it is written. product_id null means a review of the shop as a whole.
-- ============================================================================

create type public.review_status as enum ('pending', 'approved', 'rejected');

create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references public.products (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete set null,
  reviewer_name text not null check (char_length(btrim(reviewer_name)) between 1 and 80),
  rating        smallint not null check (rating between 1 and 5),
  title         text check (title is null or char_length(title) <= 120),
  body          text not null check (char_length(btrim(body)) between 1 and 2000),
  status        public.review_status not null default 'pending',
  reply         text check (reply is null or char_length(reply) <= 1000),
  replied_at    timestamptz,
  moderated_by  uuid references auth.users (id) on delete set null,
  moderated_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- One review per customer per product (and one for the shop itself).
create unique index reviews_one_per_customer
  on public.reviews (user_id, coalesce(product_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where user_id is not null;
create index reviews_status_idx  on public.reviews (status, created_at desc);
create index reviews_product_idx on public.reviews (product_id) where status = 'approved';

alter table public.reviews enable row level security;

create policy reviews_public_read on public.reviews for select to anon, authenticated
  using (status = 'approved');
create policy reviews_own_read on public.reviews for select to authenticated
  using (user_id = auth.uid());
create policy reviews_staff_read on public.reviews for select to authenticated
  using (public.is_staff());
create policy reviews_customer_insert on public.reviews for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reply is null and moderated_by is null);
create policy reviews_owner_delete on public.reviews for delete to authenticated
  using (public.is_owner());

create trigger reviews_audit after insert or update or delete on public.reviews
  for each row execute function public.log_row_change();

-- Approve, reject or reply. p_reply: null leaves the reply as it is, '' removes it.
create function public.moderate_review(
  p_id     uuid,
  p_status public.review_status,
  p_reply  text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'Only staff can moderate reviews' using errcode = '42501';
  end if;

  update public.reviews r set
    status       = p_status,
    reply        = case when p_reply is null then r.reply else nullif(btrim(p_reply), '') end,
    replied_at   = case when p_reply is null then r.replied_at
                        when btrim(p_reply) = '' then null
                        else now() end,
    moderated_by = auth.uid(),
    moderated_at = now()
  where r.id = p_id;

  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
end $$;

revoke execute on function public.moderate_review(uuid, public.review_status, text) from public, anon;
grant  execute on function public.moderate_review(uuid, public.review_status, text) to authenticated;

-- Average rating per product, approved reviews only. Safe for the public storefront.
create view public.v_product_ratings with (security_invoker = on) as
  select product_id,
         round(avg(rating)::numeric, 2) as average_rating,
         count(*)                       as review_count
    from public.reviews
   where status = 'approved'
   group by product_id;

grant select on public.v_product_ratings to anon, authenticated;
