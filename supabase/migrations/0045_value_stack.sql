-- Reported gap: the Offer section's free-text "Bonuses" field had a hint saying "List each bonus
-- and its perceived value," but nothing actually captured a real NUMBER per bonus — a generator
-- had to guess values out of prose, with no way to compute a running total or know how the price
-- compares to it. The real Perfect Webinar/Expert Secrets stack technique needs exact numbers:
-- introduce the core offer's own value, reveal 2-3 more stack items (each with its own value)
-- progressively through the offer section rather than all at once, total everything up, THEN
-- reveal the price as dramatically smaller than that total.
--
-- Additive only — the existing `bonuses` free-text field is untouched (kept for context/notes
-- that don't fit a clean name+value pair) and nothing here is added to REQUIRED_DISCOVERY_FIELDS,
-- so no existing project is retroactively locked out of its agents for not having filled this in.
alter table public.projects
  add column if not exists core_offer_value text not null default '',
  add column if not exists stack_items jsonb not null default '[]'::jsonb;

comment on column public.projects.core_offer_value is
  'The core offer''s own dollar value (e.g. "$997") — introduced first in the Value Stack reveal, before any bonus. Optional; plain text like price/guarantee, not a validated number.';
comment on column public.projects.stack_items is
  'Ordered list of {"name": string, "value": string} bonus/stack items, each revealed progressively (not all at once) after the core offer, building toward a total stack value shown before the price. Optional, defaults to an empty array.';
