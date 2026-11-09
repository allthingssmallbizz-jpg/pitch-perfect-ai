-- Demo mode vs. Live mode, per project.
--   Demo: built from example data (every template starts here) to show what a finished
--         presentation looks like. The Strategy Review never blocks — critical issues are shown
--         as "would block in Live mode" — and presentation agents skip the review checkpoint.
--         Discovery marks example-only claims, and every generation made in Demo mode is labeled
--         "Demo" so it's never mistaken for something ready for a live webinar.
--   Live: the normal, strict behavior (real proof, critical issues resolved before approval).
-- generations.is_demo records the mode at generation time, so a deck built in Demo mode keeps its
-- Demo label even after the project is switched to Live.

alter table public.projects add column if not exists is_demo boolean not null default false;
alter table public.generations add column if not exists is_demo boolean not null default false;

-- Projects already created from a template are demo projects.
update public.projects set is_demo = true where name like '%(from template)%' and is_demo = false;
update public.generations g
  set is_demo = true
  from public.projects p
  where g.project_id = p.id and p.is_demo = true and g.is_demo = false;
