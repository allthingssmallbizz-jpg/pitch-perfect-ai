-- Adds the one missing beat of the Epiphany Bridge story structure (see
-- src/lib/ai/knowledge/10-epiphany-bridge.md) to the presenter bio: the specific realization or
-- insight that changed everything, stated as something discovered in the moment rather than a
-- lesson being taught. "A major setback — and how you turned it around" already captured the Wall
-- and a loose sense of the turnaround, but nothing asked for the exact epiphany line itself — the
-- actual belief-shift payload every Opening Story/Credibility Bridge beat hinges on.
--
-- Optional, like presenter_signature_win and presenter_setback_story next to it (see
-- REQUIRED_BIO_FIELDS in presenterBio.ts) — someone brand new may genuinely not have this moment
-- yet for this business, and requiring it would block exactly the person who most needs to get
-- moving.
alter table public.presenter_bio_profiles
  add column if not exists presenter_epiphany_moment text not null default '';

comment on column public.presenter_bio_profiles.presenter_epiphany_moment is
  'The specific realization/insight that changed everything for the presenter — the Epiphany beat of the Epiphany Bridge story structure (see knowledge/10-epiphany-bridge.md). Optional; blank means they have not had this moment yet for this business.';
