-- Product photos: several per product, the first one is the cover.
-- Files live in the public "product-images" storage bucket; only the owner can add or remove them.

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path       text not null unique,            -- file path inside the bucket
  sort_order integer not null default 0,      -- 0 = cover photo
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

alter table public.product_images enable row level security;
create policy staff_read  on public.product_images for select to authenticated using (public.is_staff());
create policy owner_write on public.product_images for all    to authenticated
  using (public.is_owner()) with check (public.is_owner());

revoke all on public.product_images from anon;
revoke truncate on public.product_images from authenticated;

-- Storage bucket (public so the future website can show the photos; 3 MB cap, images only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_owner());
create policy product_images_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_owner());
create policy product_images_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_owner());
