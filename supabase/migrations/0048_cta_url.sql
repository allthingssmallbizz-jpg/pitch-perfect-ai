-- Reported need: a webinar/VSL/challenge close telling people to "click the link below" has
-- nothing to click in a live or recorded presentation — this is the real destination URL
-- (checkout, booking, or registration page) every generator's call-to-action can now state
-- directly when one is provided. See formatDiscoveryBlock (shared.ts) for how it's surfaced.
alter table public.projects
  add column if not exists cta_url text not null default '';

comment on column public.projects.cta_url is
  'The real checkout/booking/registration link the primary CTA sends people to. Optional free text, defaults to empty string like every other discovery field.';
