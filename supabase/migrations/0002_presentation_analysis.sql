-- Adds the Presentation Analyzer feature: a metered tool that critiques a pasted
-- webinar/VSL/sales-presentation/investor-pitch script against a 19-point conversion
-- rubric, reusing the same generations table and credit-guardrail pipeline as the
-- asset generators.

-- Allow the new asset_type value.
alter table public.generations
  drop constraint if exists generations_asset_type_check;

alter table public.generations
  add constraint generations_asset_type_check
  check (asset_type in (
    'webinar_outline', 'vsl_script', 'sales_page', 'landing_page', 'email_sequence',
    'ppt_outline', 'presentation_analysis'
  ));

-- Stores the pasted presentation content being analyzed, so users can review what they
-- submitted alongside the critique. Null for ordinary generators (their input is always
-- reconstructable from the project's discovery fields).
alter table public.generations
  add column if not exists input_content text;
