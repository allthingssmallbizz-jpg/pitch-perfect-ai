-- Adds a "My Webinar Bio" / presenter-story section to project discovery — the facts a
-- Credibility Bridge (VSL stage 5) and Opening Story (VSL stage 6) actually need, which the
-- existing discovery fields never captured (those are all about the BUSINESS/OFFER, not the
-- person presenting it). Additive only, same pattern as 0005_full_discovery.sql — all optional
-- (not added to REQUIRED_DISCOVERY_FIELDS), so no existing project is newly blocked from
-- generating until these are filled in.

alter table public.projects
  add column if not exists presenter_mission text not null default '',
  add column if not exists presenter_years_experience text not null default '',
  add column if not exists presenter_credentials text not null default '',
  add column if not exists presenter_origin_story text not null default '',
  add column if not exists presenter_signature_win text not null default '',
  add column if not exists presenter_setback_story text not null default '',
  add column if not exists presenter_income_goal_6mo text not null default '',
  add column if not exists presenter_income_goal_12mo text not null default '',
  add column if not exists presenter_mission_why text not null default '',
  add column if not exists presenter_recognition text not null default '',
  add column if not exists presenter_relatable_detail text not null default '';
