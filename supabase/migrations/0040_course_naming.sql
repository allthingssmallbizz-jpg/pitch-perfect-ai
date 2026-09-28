-- Agent Cora's "name your course and modules yourself" box (see courseOutline.ts's customNaming
-- param) used to be typed fresh every single time — nothing remembered it between regenerations,
-- so a member had to retype their course title and module names on every Regenerate, and a course
-- naturally has its own name/subtitle distinct from whatever webinar or offer it may be based on
-- (reported: "the course most likely will not be the same as the webinar"). Persisting it here
-- means it's set once and every future course_outline generation for this project remembers it
-- automatically, without retyping and without confusing it with project.offer_name (the
-- webinar/offer's own name).
alter table public.projects
  add column if not exists course_naming text not null default '';

comment on column public.projects.course_naming is
  'Agent Cora''s persisted "name the course/modules yourself" override (see courseOutline.ts buildCourseOutlinePrompt) — set once on the Course Outline page, remembered on every future regenerate instead of being retyped each time. Blank means Cora invents the course title and every module name itself.';
