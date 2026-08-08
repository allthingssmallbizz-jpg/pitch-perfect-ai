-- Version history for edits made to a generation's content after it's created — the deferred
-- "persisted version history" feature (ported from the Lovable prototype's deliverable_versions
-- table, adapted to this app's per-generation-run model rather than a per-deliverable-type
-- singleton: each generations row gets its own version timeline).
--
-- generations.content remains the single source of truth for display/export (unchanged by this
-- migration) — a version row is a point-in-time snapshot, not a live value. Rows are written by
-- generateAsset() at creation time (source='generate') and by explicit "Save" / "Restore"
-- actions in the editor (source='edit' / 'snapshot'); the debounced autosave that keeps content
-- persisted while typing deliberately does NOT create a version on every tick — see
-- src/lib/actions/versions.ts.

create table if not exists public.generation_versions (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  source text not null check (source in ('generate', 'edit', 'snapshot')),
  label text,
  created_at timestamptz not null default now()
);

create index if not exists idx_generation_versions_generation
  on public.generation_versions(generation_id, created_at desc);

alter table public.generation_versions enable row level security;

-- Same pattern as generations: owner reads their own; all writes go through the service role
-- from server actions (src/lib/actions/versions.ts), never directly from the browser.
drop policy if exists "generation_versions_select_own" on public.generation_versions;
create policy "generation_versions_select_own" on public.generation_versions for select
  using (auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
