-- 0031's backfill pointed EVERY pre-existing project owned by an account at the SAME single
-- "My Bio" profile (see that migration's `update projects ... where bp.user_id = p.user_id`,
-- which isn't scoped per-project). That's harmless for an account that only had one project at
-- the time, but a Silver/Platinum/Founding member who already had several projects ended up with
-- all of them sharing one bio row — completing or editing it for one project silently changed
-- what every other project saw too, and none of them could ever have their own separate story.
--
-- Reported by Aaron: inside a second project ("Travel Academy"), the app kept redirecting to
-- finish "the" bio, but the bio shown was the one that actually belonged to a different project
-- ("Legacy to Launch") — same underlying row, shared by both.
--
-- Fix: for every account where more than one active project points at the same bio profile,
-- leave the original attached to whichever of those projects is oldest (in every case this is
-- the pre-existing "legacy" project 0031's backfill was actually written for), and give every
-- OTHER project in the group a brand-new, blank bio profile of its own, labeled after that
-- project. Left blank rather than copied: the shared bio's content describes one specific
-- business, so copying it into a different project's profile would just relabel one niche's
-- story as another's instead of actually separating them — the member fills in each project's
-- real story from here.
--
-- Idempotent: once every profile maps to at most one active project, the "not in" subquery below
-- returns nothing, so running this again after it's already applied is a no-op.
do $$
declare
  proj record;
  new_id uuid;
begin
  for proj in
    select p.id as project_id, p.name as project_name, p.user_id
    from public.projects p
    where p.deleted_at is null
      and p.presenter_bio_profile_id is not null
      and p.id not in (
        select distinct on (presenter_bio_profile_id) id
        from public.projects
        where deleted_at is null and presenter_bio_profile_id is not null
        order by presenter_bio_profile_id, created_at asc, id asc
      )
  loop
    insert into public.presenter_bio_profiles (user_id, label)
    values (proj.user_id, proj.project_name)
    returning id into new_id;

    update public.projects set presenter_bio_profile_id = new_id where id = proj.project_id;
  end loop;
end $$;
