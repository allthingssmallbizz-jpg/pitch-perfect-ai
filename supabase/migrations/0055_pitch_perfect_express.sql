-- Pitch Perfect Express™: short-form presentations (10-25 slides) for meetings, speaking slots,
-- group leaders, and decision-makers, plus a Speaker Kit (host introduction, speaker bio, the
-- close, objection responses, and follow-up messages). Two new generation types:
--   express_deck — the presentation itself (Agent Piper). Its intake brief is stored in
--                  generations.input_content as JSON.
--   express_kit  — the Speaker Kit, built from the latest Express presentation (Agent Fiona).
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
    'course_module_quiz', 'course_module_workbook', 'challenge_day_slides',
    'express_deck', 'express_kit'
  ));
