-- Agent Cora's "Completed Courses" feature — a member reported wanting a completed course/module
-- deck to sit in a section of its own once they've reviewed and approved it, separate from the
-- plain chronological "Past generations" list every agent already has, so it's easy to find and
-- download later without hunting through every draft.
--
-- approved_at: set once a member explicitly approves a generation (see /api/generations/[id]/
-- approve); null means it still just lives in the ordinary Past generations list. Scoped to
-- Cora's four asset types in the app layer, not here — this column is harmless (and simply always
-- null) on every other asset type.
--
-- module_identifier: persists WHICH module a course_module_slides/quiz/workbook generation was
-- built for (e.g. "Module 3: Building Your Offer") — previously this was only ever a transient
-- request parameter used to build the prompt, never saved, so there was no way to label a past
-- generation with the module it belongs to afterward. Null for course_outline itself (a course
-- has one outline, not one per module).
alter table public.generations
  add column if not exists approved_at timestamptz,
  add column if not exists module_identifier text;

comment on column public.generations.approved_at is
  'Set when a member marks this generation "Completed" (Agent Cora''s Completed Courses section). Null = still just an ordinary past generation.';
comment on column public.generations.module_identifier is
  'Which module this generation was built for (course_module_slides/quiz/workbook only), e.g. "Module 3: Building Your Offer". Null for course_outline and every non-Cora asset type.';
