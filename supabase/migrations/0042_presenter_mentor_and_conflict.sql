-- Adds the last two Epiphany Bridge beats the presenter bio never asked for (see
-- src/lib/ai/knowledge/10-epiphany-bridge.md): The Mentor (beat 4 — what or who helped break
-- through the Wall: a person, a book, a data point, a client's comment, or plainly "no one, I
-- figured it out alone") and The Conflict (beat 7 — the real obstacle the new plan still hit
-- after the presenter committed to it, the darkest point before the Achievement). Without them,
-- the webinar/VSL generators had to write those two beats generically and flag them as gaps.
--
-- Optional, like presenter_setback_story and presenter_epiphany_moment next to them (see
-- REQUIRED_BIO_FIELDS in presenterBio.ts) — someone brand new may genuinely not have these yet.
alter table public.presenter_bio_profiles
  add column if not exists presenter_mentor text not null default '',
  add column if not exists presenter_conflict_story text not null default '';

comment on column public.presenter_bio_profiles.presenter_mentor is
  'What or who helped the presenter break through their Wall — the Mentor beat of the Epiphany Bridge story structure (see knowledge/10-epiphany-bridge.md). Optional.';
comment on column public.presenter_bio_profiles.presenter_conflict_story is
  'The real obstacle the presenter''s new plan still hit after they committed to it — the Conflict/Ordeal beat of the Epiphany Bridge story structure (see knowledge/10-epiphany-bridge.md). Optional.';
