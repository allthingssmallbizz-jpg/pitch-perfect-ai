-- Adds "brand_color_surprise" as an allowed asset_type for the "Surprise me" AI color palette
-- suggestion on the Brand Voice page (src/lib/ai/brandColorPalette.ts) — a lightweight utility
-- call logged purely for cost telemetry, same category as discovery_assist/website_import/
-- offer_builder, not a browsable generator asset.

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist', 'ad_image', 'website_import', 'social_compare',
    'offer_builder', 'brand_color_surprise'
  ));
