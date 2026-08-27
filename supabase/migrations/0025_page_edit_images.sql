-- Images uploaded through the "ask for an update" AI page-edit panel (see
-- src/lib/ai/generators/pageEdit.ts and /api/generations/[id]/upload-image) — a member can
-- attach a photo and describe where it should go, instead of needing to host it themselves.
--
-- Public (unlike ad-images, which is private + signed-URL) because these images get embedded
-- directly into a Landing/Thank You Page's HTML via a plain <img src="..."> — that page can stay
-- published indefinitely, so the image URL has to keep working indefinitely too. A signed URL
-- (which expires) would silently break the image on the live page after an hour.
insert into storage.buckets (id, name, public, file_size_limit)
values ('page-images', 'page-images', true, 8388608) -- 8MB per file
on conflict (id) do nothing;

drop policy if exists "page_images_owner_write" on storage.objects;
create policy "page_images_owner_write" on storage.objects for insert
  with check (bucket_id = 'page-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "page_images_owner_delete" on storage.objects;
create policy "page_images_owner_delete" on storage.objects for delete
  using (bucket_id = 'page-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "page_images_public_read" on storage.objects;
create policy "page_images_public_read" on storage.objects for select
  using (bucket_id = 'page-images');
