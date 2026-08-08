-- Expands project discovery from a short flat brief into the full Discovery -> Customer
-- Awareness -> Positioning -> Value Proposition -> Offer intake (the field set the Lovable
-- prototype's wizard used) — the facts a real VSL/webinar/sales-page actually needs: awareness
-- level, false beliefs, the enemy/villain, unique mechanism, competitive alternatives, etc.
-- Not just "who it's for / the problem / the transformation."
--
-- Additive only — old columns (who_its_for, the_problem, the_transformation, one_result) are
-- left in place rather than dropped, so no existing project data is destroyed; the app itself
-- stops reading/writing them after this migration. Best-effort backfill below carries their
-- values into the closest new field for continuity.

alter table public.projects
  -- Discovery
  add column if not exists business_name text not null default '',
  add column if not exists industry text not null default '',
  add column if not exists product text not null default '',
  add column if not exists audience text not null default '',
  add column if not exists existing_assets text not null default '',
  -- Customer Awareness
  add column if not exists awareness_level text not null default '',
  add column if not exists pain_points text not null default '',
  add column if not exists false_beliefs text not null default '',
  add column if not exists desired_transformation text not null default '',
  -- Positioning
  add column if not exists category text not null default '',
  add column if not exists enemy text not null default '',
  add column if not exists differentiator text not null default '',
  add column if not exists competitive_alternatives text not null default '',
  -- Value Proposition
  add column if not exists unique_mechanism text not null default '',
  add column if not exists core_promise text not null default '',
  add column if not exists outcomes text not null default '',
  -- Offer (price/bonuses/guarantee/proof already exist from 0001_init.sql)
  add column if not exists scarcity_urgency text not null default '',
  add column if not exists cta text not null default '';

update public.projects set audience = who_its_for
  where audience = '' and who_its_for is not null and who_its_for <> '';
update public.projects set pain_points = the_problem
  where pain_points = '' and the_problem is not null and the_problem <> '';
update public.projects set desired_transformation = the_transformation
  where desired_transformation = '' and the_transformation is not null and the_transformation <> '';
update public.projects set core_promise = one_result
  where core_promise = '' and one_result is not null and one_result <> '';

comment on column public.projects.awareness_level is
  'One of: Unaware, Problem-Aware, Solution-Aware, Product-Aware, Most Aware.';
