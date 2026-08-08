-- Adds video upload + analysis to Agent Annie (Presentation Analyzer): a Supabase Storage
-- bucket for uploaded video, and the columns needed to track a staged async pipeline
-- (upload -> transcribe -> extract frames -> analyze) since processing a long video can't
-- fit in a single request/response cycle.

-- ============================================================================
-- STORAGE BUCKET  (private; users can only read/write their own folder)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('presentation-videos', 'presentation-videos', false, 524288000) -- 500MB per file
on conflict (id) do nothing;

drop policy if exists "presentation_videos_owner_all" on storage.objects;
create policy "presentation_videos_owner_all" on storage.objects for all
  using (bucket_id = 'presentation-videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'presentation-videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- GENERATIONS  (video pipeline tracking columns + expanded status for the staged flow)
-- ============================================================================
alter table public.generations
  drop constraint if exists generations_status_check;

alter table public.generations
  add constraint generations_status_check
  check (status in (
    'pending', 'uploaded', 'transcribing', 'extracting_frames', 'analyzing', 'complete', 'failed'
  ));

alter table public.generations
  add column if not exists video_path text,
  add column if not exists video_duration_seconds integer,
  add column if not exists video_size_bytes bigint,
  add column if not exists transcript text,
  add column if not exists progress_message text,
  add column if not exists transcription_cost_usd numeric(10, 6) default 0;

comment on column public.generations.video_path is
  'Storage path in the presentation-videos bucket, e.g. "{user_id}/{generation_id}/source.mp4". Null for non-video generations.';
comment on column public.generations.cost_usd is
  'Total cost for this generation, including transcription_cost_usd when this was a video analysis.';
