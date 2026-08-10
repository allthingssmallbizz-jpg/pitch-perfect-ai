-- Fixes "infinite recursion detected in policy for relation \"profiles\"" — every one of these
-- policies grants access with "you own this row OR you're an admin," and the admin check queries
-- public.profiles to look up the role. That subquery is itself subject to profiles' own RLS
-- policy (profiles_select_own), which contains the exact same admin-check subquery against
-- profiles — Postgres re-evaluates the policy to answer the policy, forever, and errors out.
--
-- This has likely been silently breaking every one of these reads from the very start: the app
-- code queries through the session-scoped (RLS-enforced) client and never checked the returned
-- `error` field until very recently, so the failure looked exactly like "no rows" — explaining
-- the long string of "past generations missing" reports this session, on generations,
-- generation_versions, and payments alike. Writes were unaffected because they go through the
-- service-role client, which bypasses RLS entirely.
--
-- Standard fix: move the admin check into a SECURITY DEFINER function. Executing as the
-- function's owner (not the calling user) means its internal query against profiles does not
-- re-trigger RLS, breaking the recursion.

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'admin'
  );
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select
  using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "generations_select_own" on public.generations;
create policy "generations_select_own" on public.generations for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "admin_settings_admin_only" on public.admin_settings;
create policy "admin_settings_admin_only" on public.admin_settings for select
  using (public.is_admin(auth.uid()));

drop policy if exists "generation_versions_select_own" on public.generation_versions;
create policy "generation_versions_select_own" on public.generation_versions for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));
