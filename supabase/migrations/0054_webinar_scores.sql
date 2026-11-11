-- Webinar Score: a member uploads (or pastes) a webinar they already have, and it's scored out of
-- 100 against the Pitch Perfect webinar framework, with what's missing and how to fix it. The
-- same analysis pulls out whatever Discovery and Bio facts the webinar states, so one click can
-- turn it into a project (project_id) that rebuilds or improves it — without starting from scratch.
-- Writes go through the server (admin client after an ownership check); members can read their own.

create table if not exists public.webinar_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default '',
  source_type text not null default 'text' check (source_type in ('pptx', 'text')),
  source_text text not null,
  slide_count int,
  status text not null default 'pending' check (status in ('pending', 'complete', 'failed')),
  score int,
  readiness text,
  analysis jsonb,
  error text,
  model text,
  cost_usd numeric not null default 0,
  credits_charged int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists webinar_scores_user_idx on public.webinar_scores (user_id, created_at desc);

alter table public.webinar_scores enable row level security;
drop policy if exists "webinar_scores_select_own" on public.webinar_scores;
create policy "webinar_scores_select_own" on public.webinar_scores for select using (user_id = auth.uid());
