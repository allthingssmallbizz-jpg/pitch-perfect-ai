-- Adds `funnel_type` as a Discovery field (which conversion pattern the offer's CTA leads to —
-- book a call, checkout, tripwire+upsell, or webinar/challenge registration; see
-- src/lib/funnelType.ts) and registers "thank_you_page" as a real, browsable generator asset
-- type. The Thank You Page generator (src/lib/ai/generators/thankYouPage.ts) branches its copy
-- on this field, since a "thanks, see you on the call" page and a "here's your receipt, and
-- here's the one-click upsell" page need genuinely different copy, not a reworded template.

alter table public.projects
  add column if not exists funnel_type text not null default '';

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist', 'ad_image', 'website_import', 'social_compare',
    'offer_builder', 'brand_color_surprise', 'thank_you_page'
  ));
