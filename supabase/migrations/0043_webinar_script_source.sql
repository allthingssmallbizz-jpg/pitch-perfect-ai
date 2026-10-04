-- A Webinar Script generation was only ever loosely associated with "this project," never with
-- the exact ppt_outline deck version it was actually built from — so once a project had more
-- than one deck version (a Regenerate, or several past generations), Create/Update Script
-- always matched against whichever deck was most recently created, not necessarily the specific
-- past version a member had open and wanted a script attached to. Same symptom on export: the
-- .pptx route always grabbed "the most recent script for this project," which could silently
-- pair a deck with a script actually written for a different version of it.
--
-- source_generation_id makes that link explicit and persisted, so a script can be correctly
-- matched back to the exact deck it was built from. Null for every non-webinar_script row, and
-- for any webinar_script generated before this column existed (those fall back to the old
-- "most recent for this project" behavior — see the app code's own fallback for why that's safe).
alter table public.generations
  add column if not exists source_generation_id uuid references public.generations(id) on delete set null;

comment on column public.generations.source_generation_id is
  'Which specific prior generation this one was built FROM — currently only set for webinar_script rows, pointing at the exact ppt_outline deck used. Null means either not applicable, or generated before this column existed.';

create index if not exists generations_source_generation_id_idx on public.generations (source_generation_id);
