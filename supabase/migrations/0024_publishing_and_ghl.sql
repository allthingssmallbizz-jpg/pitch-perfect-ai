-- Two things needed to make a generated Landing/Thank You Page "just go live" without the member
-- ever touching hosting or DNS, and to route its opt-in form straight into their own Go High
-- Level account:
--
-- 1. Publishing: the HTML already lives in generations.content — this just adds a public slug +
--    a published flag so a fully public route (src/app/site/[slug]/route.ts, no auth) can serve
--    it back verbatim at {NEXT_PUBLIC_APP_URL}/site/{slug}. No external hosting account, no DNS.
-- 2. Go High Level: one Private Integration token + Location ID per member account (pasted in
--    from their own GHL sub-account's Settings > Private Integrations — no OAuth app / GHL
--    Marketplace approval needed), used by the public form-submission route to upsert + tag every
--    lead, which is what fires any GHL Workflow/Automation the member has built on that tag.

alter table public.generations
  add column if not exists publish_slug text,
  add column if not exists published_at timestamptz;

create unique index if not exists generations_publish_slug_key
  on public.generations (publish_slug) where publish_slug is not null;

-- Same owner-only RLS pattern as brand_voices/presenter_bios — one row per user, readable/writable
-- only by that user via the normal session-scoped client.
create table if not exists public.ghl_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  location_id text not null default '',
  api_token text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_ghl_connections_updated_at on public.ghl_connections;
create trigger trg_ghl_connections_updated_at before update on public.ghl_connections
  for each row execute function public.set_updated_at();

alter table public.ghl_connections enable row level security;

drop policy if exists "ghl_connections_owner_all" on public.ghl_connections;
create policy "ghl_connections_owner_all" on public.ghl_connections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Every form submission from a published page, regardless of whether GHL sync succeeds — a
-- lead is never silently lost to a CRM API hiccup or to not having connected GHL yet. Written by
-- the public (unauthenticated) form-submission route via the service-role client, same
-- "no owner INSERT policy, admin client only" pattern as `generations` itself.
create table if not exists public.form_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  generation_id uuid references public.generations(id) on delete set null,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  ghl_synced boolean not null default false,
  ghl_error text,
  created_at timestamptz not null default now()
);

alter table public.form_leads enable row level security;

drop policy if exists "form_leads_owner_select" on public.form_leads;
create policy "form_leads_owner_select" on public.form_leads for select
  using (auth.uid() = user_id);
