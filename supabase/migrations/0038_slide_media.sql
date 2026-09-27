-- Slide-level visual media for Cora's Build Module Slides deck (course_module_slides) — an
-- AI-generated illustrative image, or a simple data chart the member fills in themselves,
-- shown inline in the in-app slide preview (SlidePreview.tsx) and baked into the exported
-- .pptx (see pptxDeckBuilder.ts). One item per slide; regenerating/replacing overwrites the
-- existing row rather than accumulating history — there's nothing here worth a version trail
-- the way a generation's own text content has.
create table if not exists public.slide_media (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slide_number int not null,
  kind text not null check (kind in ('image', 'chart')),
  storage_path text, -- set when kind = 'image' — path in the slide-images bucket
  chart_type text check (chart_type in ('bar', 'line', 'pie')), -- set when kind = 'chart'
  chart_data jsonb, -- set when kind = 'chart': { "labels": string[], "values": number[] }
  prompt text, -- the image prompt used, or the chart's title — shown back to the member
  created_at timestamptz not null default now(),
  unique (generation_id, slide_number)
);

alter table public.slide_media enable row level security;

-- Same shape as `generations` itself (see 0001_init.sql) — members can read their own rows;
-- every write goes through a server route using the admin client, so no insert/update/delete
-- policy is needed here.
drop policy if exists "slide_media_select_own" on public.slide_media;
create policy "slide_media_select_own" on public.slide_media for select
  using (user_id = auth.uid());

-- ============================================================================
-- STORAGE BUCKET  (private; users can only read/write their own folder — mirrors ad-images)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('slide-images', 'slide-images', false, 8388608) -- 8MB per file
on conflict (id) do nothing;

drop policy if exists "slide_images_owner_all" on storage.objects;
create policy "slide_images_owner_all" on storage.objects for all
  using (bucket_id = 'slide-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'slide-images' and (storage.foldername(name))[1] = auth.uid()::text);
