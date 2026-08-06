-- PITCH PERFECT AI — core schema
-- Run against a Supabase Postgres project (SQL editor or `supabase db push`).

-- ============================================================================
-- PROFILES  (1 row per auth.users row; the 12-month access window + credit meter live here)
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'member' check (role in ('member', 'admin')),

  -- 12-month access window (per the build spec: "each account = one access window")
  access_started_at timestamptz not null default now(),
  access_expires_at timestamptz not null default (now() + interval '12 months'),

  -- credit meter — the margin-protection guardrail
  credits_balance integer not null default 200,
  credits_monthly_allotment integer not null default 200,
  credits_reset_at timestamptz not null default (now() + interval '1 month'),

  stripe_customer_id text,
  stripe_subscription_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_stripe_customer on public.profiles(stripe_customer_id);

-- ============================================================================
-- PROJECTS  (one per offer; mirrors the GPT's discovery workflow)
-- ============================================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,

  -- Discovery fields (Discovery Operating Manual / Offer Discovery SOP)
  who_its_for text default '',
  the_problem text default '',
  the_transformation text default '',
  price text default '',
  bonuses text default '',
  guarantee text default '',
  proof text default '',
  one_result text default '',
  discovery_notes text default '',

  mode text not null default 'expert' check (mode in ('coach', 'expert')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user on public.projects(user_id);

-- ============================================================================
-- GENERATIONS  (every asset generation + full cost telemetry)
-- ============================================================================
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  asset_type text not null check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence', 'ppt_outline'
  )),
  mode text not null check (mode in ('coach', 'expert')),

  status text not null default 'pending' check (status in ('pending', 'complete', 'failed')),
  content text,

  model text,
  input_tokens integer default 0,
  output_tokens integer default 0,
  cost_usd numeric(10, 6) default 0,
  credits_charged integer not null default 0,

  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_generations_user on public.generations(user_id);
create index if not exists idx_generations_project on public.generations(project_id);
create index if not exists idx_generations_created on public.generations(created_at);

-- ============================================================================
-- ADMIN SETTINGS  (singleton row — the global kill switch)
-- ============================================================================
create table if not exists public.admin_settings (
  id boolean primary key default true constraint singleton check (id),
  daily_spend_cap_usd numeric(10, 2) not null default 25.00,
  kill_switch_enabled boolean not null default false,
  kill_switch_reason text,
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (id) values (true) on conflict (id) do nothing;

-- ============================================================================
-- CREDIT TOP-UPS  (one-off packs purchased via Stripe)
-- ============================================================================
create table if not exists public.credit_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credits integer not null,
  amount_usd numeric(10, 2) not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ============================================================================
-- New-user provisioning: auto-create a profile with a 12-month access window
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.generations enable row level security;
alter table public.admin_settings enable row level security;
alter table public.credit_topups enable row level security;

-- profiles: users read/update their own row; admins read all
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select
  using (auth.uid() = id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id);

-- projects: owner-only
drop policy if exists "projects_owner_all" on public.projects;
create policy "projects_owner_all" on public.projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- generations: owner reads their own; admins read all. Inserts/updates happen via service role from the server.
drop policy if exists "generations_select_own" on public.generations;
create policy "generations_select_own" on public.generations for select
  using (auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- admin_settings: admins only
drop policy if exists "admin_settings_admin_only" on public.admin_settings;
create policy "admin_settings_admin_only" on public.admin_settings for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- credit_topups: owner reads their own
drop policy if exists "credit_topups_select_own" on public.credit_topups;
create policy "credit_topups_select_own" on public.credit_topups for select
  using (auth.uid() = user_id);
