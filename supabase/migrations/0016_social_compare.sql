-- Adds "social_compare" as an allowed asset_type for Agent Annie's social media comparison
-- tool (src/app/api/analyze/social-compare/route.ts) — compares a member's own TikTok/
-- Instagram/Facebook page against a high-performing page they want to learn from. Unlike
-- discovery_assist/website_import/tts_narration, this DOES produce a real, browsable,
-- saveable/exportable markdown asset, so it's stored the same way as every other generator's
-- output (not just a lightweight telemetry row).

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist', 'ad_image', 'website_import', 'social_compare'
  ));
