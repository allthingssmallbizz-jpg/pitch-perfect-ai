-- Follow-up to 0045_value_stack.sql. Reported gap: the Value Stack editor had one undifferentiated
-- list, with no way to tell "a core component of the offer itself" apart from "a separate extra
-- gift thrown in on top" — real Perfect Webinar stacks distinguish the two in how they're
-- introduced during the reveal ("included in the program" vs. "and I'll also throw in..."), even
-- though both still count toward the same running total. Also missing entirely: a Fast Action
-- Bonus — reserved for whoever acts quickest (first N buyers, a short time window) — which is a
-- genuinely different mechanism tied to urgency/scarcity near the close, not part of the Value
-- Stack's own reveal.
--
-- No column shape change needed for stack_items itself — `category` is a new optional key inside
-- each JSON object already stored there (see the StackItem type), so every existing row keeps
-- working unchanged and simply defaults to "stack" wherever it's read (see formatValueStackBlock).
-- fast_action_bonuses is a genuinely new, separate column: additive and optional, like
-- core_offer_value/stack_items before it, so no existing project is retroactively locked out.
alter table public.projects
  add column if not exists fast_action_bonuses jsonb not null default '[]'::jsonb;

comment on column public.projects.fast_action_bonuses is
  'Ordered list of {"name": string, "value": string, "condition": string} bonuses reserved for whoever acts fastest (e.g. "the first 5 people") — revealed after the price, tied to urgency/scarcity, separate from the ordinary stack_items reveal. Optional, defaults to an empty array.';
