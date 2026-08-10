-- Projects go into a recoverable trash instead of being permanently destroyed by a single
-- delete click. Repeated reports of entire projects (and everything generated in them)
-- vanishing after a delete action motivated this — regardless of exactly which click triggers
-- it, a project should never be unrecoverable from one click again.

alter table public.projects
  add column if not exists deleted_at timestamptz;

create index if not exists idx_projects_deleted_at on public.projects(deleted_at);
