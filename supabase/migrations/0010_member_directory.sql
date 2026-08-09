-- Member directory upgrades for the admin panel: a free-text tier label you assign yourself
-- (e.g. "Member", "Pro", "Founding Member" — no Stripe changes, this is purely descriptive),
-- and a payments ledger so "what has this member actually paid" (membership + top-ups,
-- including renewals) can be shown accurately. Before this, membership renewal amounts were
-- never recorded anywhere — invoice.paid only extended access_expires_at, no dollar figure —
-- so there was no way to compute real lifetime revenue per member.

alter table public.profiles
  add column if not exists tier text not null default 'Member';

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('membership', 'topup')),
  amount_usd numeric(10, 2) not null,
  -- Only meaningful for type = 'topup' — how many credits that purchase granted.
  credits integer,
  stripe_checkout_session_id text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_user on public.payments(user_id, created_at desc);

alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments for select
  using (auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

comment on table public.payments is
  'Every Stripe payment (initial membership checkout, membership renewals, credit top-ups) —
   the source of truth for per-member revenue in the admin panel. Written by
   src/app/api/stripe/webhook/route.ts alongside the existing credit_topups inserts (which
   remain unchanged, used by the member-facing /billing top-up history).';
