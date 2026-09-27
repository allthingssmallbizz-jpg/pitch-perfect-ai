-- Registers "course_outline" as a real generator asset type — Agent Cora, The Course Architect:
-- a module-by-module transformational course curriculum (Basic/Intermediate/Advanced), built from
-- the same discovery brief every other generator uses. See
-- src/lib/ai/generators/courseOutline.ts and src/lib/agents/config.ts.

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist', 'ad_image', 'website_import', 'social_compare',
    'offer_builder', 'brand_color_surprise', 'thank_you_page', 'challenge_outline',
    'ihelp_builder', 'webinar_script', 'course_outline'
  ));
