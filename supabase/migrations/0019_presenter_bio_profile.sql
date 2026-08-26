-- Moves "My Webinar Bio" (0017_presenter_bio.sql) off the per-project Discovery form and onto
-- its own account-level page, same pattern as Brand Voice (0003_redesign_features.sql): one row
-- per user, filled in once, folded into every generation's system prompt automatically — so a
-- member never re-answers "how did you get into this industry" for every new project, and the
-- Discovery form goes back to just the business/offer questions instead of 25 fields at once.
--
-- Additive-then-cleanup, same spirit as 0005_full_discovery.sql's backfill: create the new
-- table, carry over anything already saved on a project (best-effort, most-recently-updated
-- project per user), then drop the now-unused columns from projects.

create table if not exists public.presenter_bios (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  presenter_mission text not null default '',
  presenter_years_experience text not null default '',
  presenter_credentials text not null default '',
  presenter_origin_story text not null default '',
  presenter_signature_win text not null default '',
  presenter_setback_story text not null default '',
  presenter_income_goal_6mo text not null default '',
  presenter_income_goal_12mo text not null default '',
  presenter_mission_why text not null default '',
  presenter_recognition text not null default '',
  presenter_relatable_detail text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_presenter_bios_updated_at on public.presenter_bios;
create trigger trg_presenter_bios_updated_at before update on public.presenter_bios
  for each row execute function public.set_updated_at();

alter table public.presenter_bios enable row level security;

drop policy if exists "presenter_bios_owner_all" on public.presenter_bios;
create policy "presenter_bios_owner_all" on public.presenter_bios for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Guarded by an existence check rather than assuming 0017_presenter_bio.sql already ran — if
-- that migration was skipped (or this is a fresh database that only ever saw the final schema),
-- `projects` never had these columns to begin with, and there's nothing to backfill.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects' and column_name = 'presenter_mission'
  ) then
    insert into public.presenter_bios (
      user_id, presenter_mission, presenter_years_experience, presenter_credentials,
      presenter_origin_story, presenter_signature_win, presenter_setback_story,
      presenter_income_goal_6mo, presenter_income_goal_12mo, presenter_mission_why,
      presenter_recognition, presenter_relatable_detail
    )
    select distinct on (user_id)
      user_id, presenter_mission, presenter_years_experience, presenter_credentials,
      presenter_origin_story, presenter_signature_win, presenter_setback_story,
      presenter_income_goal_6mo, presenter_income_goal_12mo, presenter_mission_why,
      presenter_recognition, presenter_relatable_detail
    from public.projects
    where presenter_mission <> '' or presenter_years_experience <> '' or presenter_credentials <> ''
       or presenter_origin_story <> '' or presenter_signature_win <> '' or presenter_setback_story <> ''
       or presenter_income_goal_6mo <> '' or presenter_income_goal_12mo <> '' or presenter_mission_why <> ''
       or presenter_recognition <> '' or presenter_relatable_detail <> ''
    order by user_id, updated_at desc
    on conflict (user_id) do nothing;
  end if;
end $$;

alter table public.projects
  drop column if exists presenter_mission,
  drop column if exists presenter_years_experience,
  drop column if exists presenter_credentials,
  drop column if exists presenter_origin_story,
  drop column if exists presenter_signature_win,
  drop column if exists presenter_setback_story,
  drop column if exists presenter_income_goal_6mo,
  drop column if exists presenter_income_goal_12mo,
  drop column if exists presenter_mission_why,
  drop column if exists presenter_recognition,
  drop column if exists presenter_relatable_detail;
