-- Agent Addie's Image Ads: the member uploads a photo, Addie writes short, image-fitted copy
-- (headline/subheadline/CTA — not the long-form multi-angle ad_copy output), and the app
-- composites that copy onto the photo client-side (canvas — no reliance on AI image
-- generation, which can't render text reliably) into a finished, downloadable ad creative.

-- ============================================================================
-- STORAGE BUCKET  (private; users can only read/write their own folder)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('ad-images', 'ad-images', false, 20971520) -- 20MB per file — photos, not video
on conflict (id) do nothing;

drop policy if exists "ad_images_owner_all" on storage.objects;
create policy "ad_images_owner_all" on storage.objects for all
  using (bucket_id = 'ad-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'ad-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- GENERATIONS  (new asset_type + the two image paths)
-- ============================================================================
alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist', 'ad_image'
  ));

alter table public.generations
  add column if not exists image_source_path text,
  add column if not exists image_result_path text;

comment on column public.generations.image_source_path is
  'Storage path in the ad-images bucket for the member''s uploaded photo, e.g. "{user_id}/{generation_id}/source.jpg". Null for non-ad_image generations.';
comment on column public.generations.image_result_path is
  'Storage path for the finished, composited ad image (photo + headline/subheadline/CTA overlaid client-side), e.g. "{user_id}/{generation_id}/result.png". Set right after compositing so a refresh or revisit never loses the finished creative.';
