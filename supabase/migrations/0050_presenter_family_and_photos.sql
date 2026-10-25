-- Reported need: every webinar opens with a short, human "meet the presenter" moment — who they
-- are, their family, why they do this work — so the audience can relate to them early, without
-- the presentation becoming about the presenter. presenter_family is the free-text detail the
-- deck generator uses for that slide; presenter_photos are real photos (family, a candid shot)
-- the member uploads on their bio and can place onto any slide (see
-- /api/bio/[profileId]/photos and /api/generations/[id]/slide-media/photo).
alter table public.presenter_bio_profiles
  add column if not exists presenter_family text not null default '',
  add column if not exists presenter_photos text[] not null default '{}';

comment on column public.presenter_bio_profiles.presenter_family is
  'Family and personal life (spouse, kids, who they do this for). Optional; used for the meet-the-presenter slide.';
comment on column public.presenter_bio_profiles.presenter_photos is
  'Storage paths in the presenter-photos bucket, in display order (max 3).';

-- Private bucket, same per-user-folder policy shape as slide-images (0038_slide_media.sql).
insert into storage.buckets (id, name, public, file_size_limit)
values ('presenter-photos', 'presenter-photos', false, 8388608) -- 8MB per file
on conflict (id) do nothing;

drop policy if exists "presenter_photos_owner_all" on storage.objects;
create policy "presenter_photos_owner_all" on storage.objects for all
  using (bucket_id = 'presenter-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'presenter-photos' and (storage.foldername(name))[1] = auth.uid()::text);
