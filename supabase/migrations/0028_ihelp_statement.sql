-- Adds the "I Help Statement" (the classic "I help [audience] [outcome] with [mechanism]"
-- positioning line) to the existing presenter_bios profile (0019_presenter_bio_profile.sql) —
-- same one-row-per-user table, same "folded into every generation automatically" pattern. Stored
-- as three parts rather than one composed sentence so the AI Assist pattern (one field at a time,
-- see DiscoveryAssistDialog) and the editable form can work on each part independently; the full
-- sentence is composed on read (see getPresenterBioBlock / PresenterBioForm), not stored, so it
-- can never drift out of sync with its own parts.

alter table public.presenter_bios
  add column if not exists presenter_ihelp_audience text not null default '',
  add column if not exists presenter_ihelp_outcome text not null default '',
  add column if not exists presenter_ihelp_mechanism text not null default '';
