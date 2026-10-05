-- Lets a member capture how a SPECIFIC presenter actually writes/speaks, scoped to their niche
-- bio (one per project — see 0031_niche_bio_profiles.sql) rather than the single account-wide
-- Brand Voice (table brand_voices). Brand Voice already does exactly this (tone, preferred/
-- forbidden words, a pasted writing sample) but only has ONE slot per account — fine for someone
-- who IS their own presenter everywhere, but not for an account building courses for several
-- different presenters/niches, where each one talks differently and the generic account-wide
-- voice can't capture more than one of them at a time. Reported by Aaron: a module's speaker
-- notes read as generic, formal AI copy instead of how the actual presenter on that course talks.
--
-- Mirrors brand_voices' own shape (see getBrandVoiceBlock) so the two forms/features stay
-- conceptually identical for anyone who's already used one of them. All optional, same reasoning
-- as presenter_credentials/presenter_recognition — someone may not have a sample ready yet, and
-- requiring one would block agents for a reason that has nothing to do with discovery readiness.
alter table public.presenter_bio_profiles
  add column if not exists presenter_voice_tone text not null default '',
  add column if not exists presenter_voice_preferred_words text not null default '',
  add column if not exists presenter_voice_forbidden_words text not null default '',
  add column if not exists presenter_voice_sample_writing text not null default '',
  add column if not exists presenter_voice_notes text not null default '';

comment on column public.presenter_bio_profiles.presenter_voice_tone is
  'How THIS presenter''s own voice should feel (personality, energy, formality) — scoped to this one niche, not the account-wide Brand Voice. Optional.';
comment on column public.presenter_bio_profiles.presenter_voice_preferred_words is
  'Words/phrases this specific presenter actually uses, that generators should prefer for this niche. Optional.';
comment on column public.presenter_bio_profiles.presenter_voice_forbidden_words is
  'Words/phrases this specific presenter would never say, that generators should avoid for this niche. Optional.';
comment on column public.presenter_bio_profiles.presenter_voice_sample_writing is
  'A real excerpt of this presenter''s own writing or speaking (an email, a transcript, a blog post) — the highest-leverage input for matching their actual rhythm and vocabulary instead of generic AI phrasing. Optional.';
comment on column public.presenter_bio_profiles.presenter_voice_notes is
  'Any other specific voice quirks for this presenter (e.g. "always says y''all", "never uses exclamation points"). Optional.';
