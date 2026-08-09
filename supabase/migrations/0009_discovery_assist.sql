-- Adds "discovery_assist" as an allowed asset_type for the per-field AI Assist button on the
-- project discovery form (ported from the Lovable prototype's wizard-assist-dialog) — same
-- reasoning as tts_narration in 0007_tts.sql: a lightweight generations row purely so real
-- token cost counts toward the daily spend cap, even though a single field's draft answer
-- isn't really a browsable "asset."

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist'
  ));
