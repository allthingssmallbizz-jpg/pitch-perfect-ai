-- Registers "challenge_outline" as a real generator asset type — a dedicated day-by-day
-- structure for a free 3-5 day challenge (the other classic engagement-funnel format alongside a
-- Webinar or VSL), rather than something a member had to improvise out of the Webinar generator.
-- See src/lib/ai/generators/challengeOutline.ts.

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist', 'ad_image', 'website_import', 'social_compare',
    'offer_builder', 'brand_color_surprise', 'thank_you_page', 'challenge_outline'
  ));
