-- Adds "tts_narration" as an allowed asset_type so the deferred TTS playback feature (Read
-- Aloud) goes through the same cost-telemetry table as every other paid call, instead of being
-- a guardrail-adjacent feature that quietly sits outside the daily spend cap's view. Each
-- narration request still gets its own lightweight generations row (see
-- src/app/api/tts/route.ts) even though there's no generated "content" to browse back to later
-- — it's audio, not a stored asset — the row exists purely for cost_usd/credits_charged
-- telemetry and the daily cap calculation in src/lib/credits.ts.

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration'
  ));
