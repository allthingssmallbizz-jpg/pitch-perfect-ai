-- Upgrades the "I Help Statement" fields added in 0028_ihelp_statement.sql from a naive
-- mechanical join ("I help {audience} {outcome} with {mechanism}") into a real AI generator:
-- a member fills in the guided fields (now including their audience's biggest struggle, which
-- sharpens the AI's output far more than audience/outcome/mechanism alone), the AI drafts
-- several stronger, more specific candidate statements, and the one they pick (or their own
-- edited version of it) is what actually gets folded into every generation's system prompt —
-- see getPresenterBioBlock in src/lib/ai/presenterBio.ts. The three raw parts from 0028 are kept
-- as-is; they're the generator's input, not replaced.

alter table public.presenter_bios
  add column if not exists presenter_ihelp_pain_point text not null default '',
  add column if not exists presenter_ihelp_statement text not null default '';

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist', 'ad_image', 'website_import', 'social_compare',
    'offer_builder', 'brand_color_surprise', 'thank_you_page', 'challenge_outline', 'ihelp_builder'
  ));
