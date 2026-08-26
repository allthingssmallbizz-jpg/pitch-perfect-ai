-- "Offer Builder" — for a member who doesn't know what to name their webinar/offer yet, or
-- what to charge, or how to close. Drafts a starter offer (name, promise, outcomes, price,
-- bonuses/demo stack, guarantee, and the recommended closing mechanism for their niche — book a
-- call, checkout page, apply, join a membership, etc.) from whatever discovery is already filled
-- in, same review-before-insert pattern as "Import from your website"
-- (0015_website_import.sql). Not a browsable generator asset — a lightweight discovery-drafting
-- utility, same category as website_import/discovery_assist.

alter table public.projects
  add column if not exists offer_name text not null default '';

alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis', 'ad_copy', 'offer_ladder', 'headline_lab',
    'tts_narration', 'discovery_assist', 'ad_image', 'website_import', 'social_compare',
    'offer_builder'
  ));
