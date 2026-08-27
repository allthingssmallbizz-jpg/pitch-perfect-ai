-- Basic analytics for published pages: views (page loads on /site/[slug]) paired with the
-- form_leads table that already exists (0024) gives views / leads / conversion % per page with
-- no new tracking concept — just one more "written by the public route via the service-role
-- client" table, same pattern as form_leads itself.
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  generation_id uuid not null references public.generations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists page_views_generation_id_idx on public.page_views (generation_id);

alter table public.page_views enable row level security;

drop policy if exists "page_views_owner_select" on public.page_views;
create policy "page_views_owner_select" on public.page_views for select
  using (auth.uid() = user_id);
