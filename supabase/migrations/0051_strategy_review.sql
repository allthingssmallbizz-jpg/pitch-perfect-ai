-- Strategy Review & Offer Validation — an AI checkpoint between Discovery and presentation
-- generation. Three tables:
--   strategy_reviews          one row per analysis run (versioned per project). Stores the exact
--                             strategy inputs analyzed, the schema-validated AI output, and the
--                             server-computed score/readiness. Discovery itself is never modified.
--   strategy_recommendations  one row per issue/recommendation in a review — keeps the original
--                             answer, the AI suggestion, the member's edited answer, and their
--                             decision (accepted / rejected / needs info / excluded / attested).
--   strategy_blueprints       the approved, frozen strategy that generation reads from. Versioned;
--                             approving again supersedes the previous one rather than editing it.
-- Every write goes through server routes using the admin client after an ownership check, same as
-- `generations` and `slide_media`, so only select policies are needed here.

create table if not exists public.strategy_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  review_version int not null,
  status text not null default 'pending' check (status in ('pending', 'complete', 'failed')),
  input_fields jsonb not null,
  carried_revisions jsonb not null default '{}'::jsonb,
  discovery_hash text not null,
  overall_score int,
  category_scores jsonb,
  critical_count int not null default 0,
  readiness_status text check (readiness_status in ('presentation_ready', 'improvements_recommended', 'needs_refinement', 'not_ready')),
  analysis jsonb,
  error text,
  model text,
  cost_usd numeric not null default 0,
  credits_charged int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, review_version)
);

-- At most one analysis in flight per project — a double-click or a retry after a dropped
-- connection can't start a second, conflicting review.
create unique index if not exists strategy_reviews_one_pending_per_project
  on public.strategy_reviews (project_id) where status = 'pending';

create table if not exists public.strategy_recommendations (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.strategy_reviews(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null default 0,
  field_id text not null,
  field_label text not null default '',
  original_answer text not null default '',
  issue text not null default '',
  explanation text not null default '',
  suggested_answer text not null default '',
  final_answer text,
  evidence_status text not null default 'not_applicable'
    check (evidence_status in ('verified', 'client_reported', 'proposed', 'missing_evidence', 'contradictory', 'not_applicable')),
  severity text not null default 'medium' check (severity in ('critical', 'high', 'medium', 'low')),
  is_critical boolean not null default false,
  requires_confirmation boolean not null default true,
  follow_up_question text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'accepted', 'rejected', 'needs_info', 'excluded', 'attested')),
  client_note text,
  coach_messages jsonb not null default '[]'::jsonb,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists strategy_recommendations_review_idx on public.strategy_recommendations (review_id);

create table if not exists public.strategy_blueprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null references public.strategy_reviews(id) on delete cascade,
  blueprint_version int not null,
  approved_fields jsonb not null,
  blueprint jsonb not null,
  selected_framework text not null default '',
  framework_reason text not null default '',
  excluded_claims jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  discovery_hash text not null,
  approved_at timestamptz not null default now(),
  superseded_at timestamptz,
  generation_status text not null default 'not_generated' check (generation_status in ('not_generated', 'generated')),
  last_generated_at timestamptz,
  unique (project_id, blueprint_version)
);

create unique index if not exists strategy_blueprints_one_current_per_project
  on public.strategy_blueprints (project_id) where superseded_at is null;

alter table public.strategy_reviews enable row level security;
alter table public.strategy_recommendations enable row level security;
alter table public.strategy_blueprints enable row level security;

drop policy if exists "strategy_reviews_select_own" on public.strategy_reviews;
create policy "strategy_reviews_select_own" on public.strategy_reviews for select using (user_id = auth.uid());
drop policy if exists "strategy_recommendations_select_own" on public.strategy_recommendations;
create policy "strategy_recommendations_select_own" on public.strategy_recommendations for select using (user_id = auth.uid());
drop policy if exists "strategy_blueprints_select_own" on public.strategy_blueprints;
create policy "strategy_blueprints_select_own" on public.strategy_blueprints for select using (user_id = auth.uid());
