-- Demo mode is only for projects created from a template (see 0052_demo_mode.sql). A member's own
-- project is always Live mode — no Demo switch is shown, and it can't be switched.
-- from_template marks template-created projects (copied by "Duplicate project").

alter table public.projects add column if not exists from_template boolean not null default false;

update public.projects set from_template = true where name like '%(from template)%' and from_template = false;

-- Any non-template project that was switched to Demo goes back to Live.
update public.projects set is_demo = false where from_template = false and is_demo = true;
