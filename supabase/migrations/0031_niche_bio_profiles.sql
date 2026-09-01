-- Presenter Bio moves from one row per account (presenter_bios, 0019_presenter_bio_profile.sql)
-- to many named "niche" profiles per account — a member running genuinely different businesses
-- (a travel agent who also coaches diabetes patients, say) used to have to overwrite their one
-- shared bio to switch niches, corrupting whatever project was still using the old niche's story.
-- Now each PROJECT points at a specific niche profile, and how many niches an account can create
-- is gated by membership tier (Gold/Silver/Platinum/Founding Member — see the profiles.tier
-- change below) plus an optional per-member admin-granted bonus (bonus_niche_limit).
--
-- presenter_bios itself is intentionally left in place, untouched — the app stops reading/writing
-- it after this ships, but it's not dropped here. Verify the cutover in production first; drop it
-- in a later cleanup migration.

create table if not exists public.presenter_bio_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  presenter_ihelp_audience text not null default '',
  presenter_ihelp_outcome text not null default '',
  presenter_ihelp_mechanism text not null default '',
  presenter_ihelp_pain_point text not null default '',
  presenter_ihelp_statement text not null default '',
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

create index if not exists presenter_bio_profiles_user_id_idx on public.presenter_bio_profiles(user_id);

drop trigger if exists trg_presenter_bio_profiles_updated_at on public.presenter_bio_profiles;
create trigger trg_presenter_bio_profiles_updated_at before update on public.presenter_bio_profiles
  for each row execute function public.set_updated_at();

alter table public.presenter_bio_profiles enable row level security;

drop policy if exists "presenter_bio_profiles_owner_all" on public.presenter_bio_profiles;
create policy "presenter_bio_profiles_owner_all" on public.presenter_bio_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Every existing account's current bio becomes their first niche, named "My Bio" — zero data
-- loss, no action required from anyone. Safe to run more than once: only fires for accounts that
-- don't already have a "My Bio" profile (idempotent under `on conflict` isn't possible here since
-- there's no unique constraint to key off, so guard with a not-exists check instead).
insert into public.presenter_bio_profiles (
  user_id, label, presenter_ihelp_audience, presenter_ihelp_outcome, presenter_ihelp_mechanism,
  presenter_ihelp_pain_point, presenter_ihelp_statement, presenter_mission, presenter_years_experience,
  presenter_credentials, presenter_origin_story, presenter_signature_win, presenter_setback_story,
  presenter_income_goal_6mo, presenter_income_goal_12mo, presenter_mission_why, presenter_recognition,
  presenter_relatable_detail, created_at, updated_at
)
select
  pb.user_id, 'My Bio', pb.presenter_ihelp_audience, pb.presenter_ihelp_outcome, pb.presenter_ihelp_mechanism,
  pb.presenter_ihelp_pain_point, pb.presenter_ihelp_statement, pb.presenter_mission, pb.presenter_years_experience,
  pb.presenter_credentials, pb.presenter_origin_story, pb.presenter_signature_win, pb.presenter_setback_story,
  pb.presenter_income_goal_6mo, pb.presenter_income_goal_12mo, pb.presenter_mission_why, pb.presenter_recognition,
  pb.presenter_relatable_detail, pb.created_at, pb.updated_at
from public.presenter_bios pb
where not exists (
  select 1 from public.presenter_bio_profiles bp where bp.user_id = pb.user_id and bp.label = 'My Bio'
);

alter table public.projects
  add column if not exists presenter_bio_profile_id uuid references public.presenter_bio_profiles(id) on delete set null;

-- Every existing project defaults to its owner's "My Bio" profile — the one created just above,
-- guaranteed to be the only "My Bio" row per user at this point in the migration.
update public.projects p
set presenter_bio_profile_id = bp.id
from public.presenter_bio_profiles bp
where bp.user_id = p.user_id and bp.label = 'My Bio' and p.presenter_bio_profile_id is null;

-- Tier becomes a real, enforced value instead of a freeform admin label (Member/Pro/Premium/
-- Founding Member, previously purely cosmetic — see 0010_member_directory.sql) now that it drives
-- an actual limit (how many niches an account can create; see TIER_NICHE_LIMITS in
-- src/lib/ai/presenterBio.ts). "Founding Member" is kept as its own real tier (unlimited niches,
-- same as Platinum) rather than collapsed into Gold — every OTHER old freeform label (Member,
-- Pro, Premium, anything else) becomes Gold, the base/most-restrictive tier, until an admin
-- upgrades that member.
update public.profiles set tier = 'Gold' where tier not in ('Gold', 'Silver', 'Platinum', 'Founding Member');

alter table public.profiles alter column tier set default 'Gold';

alter table public.profiles
  drop constraint if exists profiles_tier_check;
alter table public.profiles
  add constraint profiles_tier_check check (tier in ('Gold', 'Silver', 'Platinum', 'Founding Member'));

-- Lets an admin grant one specific member extra niche-creation allowance on top of whatever their
-- tier alone would give them ("give a member more account creation if he wants to") — additive,
-- not a replacement for the tier limit, so a Gold member with bonus_niche_limit = 2 gets 1 + 2 = 3
-- niches without needing a full tier upgrade. See canCreateBioProfile in
-- src/lib/ai/presenterBio.ts and MemberTierForm.tsx for where this is set.
alter table public.profiles
  add column if not exists bonus_niche_limit integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_bonus_niche_limit_check;
alter table public.profiles
  add constraint profiles_bonus_niche_limit_check check (bonus_niche_limit >= 0);
