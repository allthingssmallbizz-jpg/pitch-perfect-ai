-- Registers "course_module_quiz" as a real generator asset type — Agent Cora's knowledge-check
-- step: a right-sized quiz (multiple choice, true/false, short-answer) for ONE module of an
-- already-generated Course Outline, with an answer key and passing guidance. See
-- src/lib/ai/generators/courseModuleQuiz.ts.

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist', 'ad_image', 'website_import', 'social_compare',
    'offer_builder', 'brand_color_surprise', 'thank_you_page', 'challenge_outline',
    'ihelp_builder', 'webinar_script', 'course_outline', 'course_module_slides',
    'course_module_quiz'
  ));
