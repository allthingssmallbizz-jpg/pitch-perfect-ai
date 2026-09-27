-- Registers "course_module_slides" as a real generator asset type — Agent Cora's own "Sarah ->
-- Polly" step: turns ONE module of an already-generated Course Outline into a real, presentable
-- slide-by-slide teaching deck. See src/lib/ai/generators/courseModuleSlides.ts.

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist', 'ad_image', 'website_import', 'social_compare',
    'offer_builder', 'brand_color_surprise', 'thank_you_page', 'challenge_outline',
    'ihelp_builder', 'webinar_script', 'course_outline', 'course_module_slides'
  ));
