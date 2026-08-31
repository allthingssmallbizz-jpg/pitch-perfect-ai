-- Registers "webinar_script" as a real generator asset type — "Create Script": the full spoken
-- talk-track for Your Webinar's slide deck, aligned 1:1 to its exact slide numbers/titles. Your
-- Webinar's own speaker notes are deliberately short (1-3 sentences for a Notes-pane glance);
-- this is the fuller, standalone script a presenter can read or rehearse from. See
-- src/lib/ai/generators/webinarScript.ts.

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist', 'ad_image', 'website_import', 'social_compare',
    'offer_builder', 'brand_color_surprise', 'thank_you_page', 'challenge_outline',
    'ihelp_builder', 'webinar_script'
  ));
