-- Adds "website_import" as an allowed asset_type for "Import from your website" on the
-- discovery form (src/app/api/discovery/import-website/route.ts) — same reasoning as
-- discovery_assist in 0009_discovery_assist.sql: a lightweight generations row purely so the
-- real token cost counts toward the daily spend cap, even though there's no single browsable
-- "asset" produced (the drafted fields go straight into the discovery form, not a saved
-- generation).

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist', 'ad_image', 'website_import'
  ));
