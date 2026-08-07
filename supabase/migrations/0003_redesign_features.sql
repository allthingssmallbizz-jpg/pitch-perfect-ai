-- Redesign follow-up: brings in the extra asset types, Brand Voice, and Headline Lab
-- ported from the Lovable design pass, on top of the existing guardrail pipeline.

-- Two new discovery-driven generator asset types (Ad Copy, Offer Ladder), plus a
-- Headline Lab asset type that — unlike every other asset type — isn't tied to one
-- project, so project_id must become nullable for it.
alter table public.generations
  alter column project_id drop not null;

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab'
  ));

-- ============================================================================
-- BRAND VOICE  (one profile per user; folded into every generation's system prompt)
-- ============================================================================
create table if not exists public.brand_voices (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tone text not null default '',
  forbidden_words text not null default '',
  preferred_words text not null default '',
  sample_writing text not null default '',
  extra_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_brand_voices_updated_at on public.brand_voices;
create trigger trg_brand_voices_updated_at before update on public.brand_voices
  for each row execute function public.set_updated_at();

alter table public.brand_voices enable row level security;

drop policy if exists "brand_voices_owner_all" on public.brand_voices;
create policy "brand_voices_owner_all" on public.brand_voices for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
