-- Reported need: a member running the same webinar/VSL multiple times with a different offer
-- link (a "book a call" version, a "book now" version, a tripwire version) to A/B test which
-- converts better has no way to tell them apart in Past Generations besides the auto-generated
-- preview snippet or timestamp. This lets any past generation carry an optional, member-given
-- label so the exact one they're looking for is a glance away instead of a guess.
alter table public.generations
  add column if not exists title text;

comment on column public.generations.title is
  'Optional member-given label for this generation (e.g. "Book a Call version", "Tripwire version") shown in Past Generations alongside the timestamp/preview, so multiple generations of the same asset type/project can be told apart. Null until a member names one.';
