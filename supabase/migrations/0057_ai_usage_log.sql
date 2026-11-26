-- AI usage log: one row per call to the Anthropic API — finished, cut off, stopped, or failed —
-- with its tokens and estimated cost, so the app's spending matches the Anthropic bill. Written
-- only by the server (service role) and read on the admin AI Spend page; members can't see it.
create table if not exists public.ai_usage_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  project_id uuid,
  feature text not null default 'untagged',
  model text,
  status text not null check (status in ('ok', 'cut_off', 'stopped', 'error')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  output_estimated boolean not null default false,
  cost_usd numeric(12, 6) not null default 0,
  duration_ms integer,
  error text,
  request_id text
);

create index if not exists ai_usage_log_created_idx on public.ai_usage_log (created_at desc);
create index if not exists ai_usage_log_feature_idx on public.ai_usage_log (feature, created_at desc);

-- No policies: only the service role (which bypasses RLS) reads or writes this table.
alter table public.ai_usage_log enable row level security;
