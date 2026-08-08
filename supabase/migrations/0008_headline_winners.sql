-- Persists Headline Lab's winner picks (ported from the Lovable prototype's
-- headline_sets.winners column) so returning to a past headline set via
-- ?generationId=... restores which headlines were marked as winners, not just the
-- generated list itself. Generic on `generations` rather than a headline-specific table
-- since this app already stores the headline list as that row's `content` — only
-- meaningful for asset_type = 'headline_lab', null/empty elsewhere.

alter table public.generations
  add column if not exists winners jsonb not null default '[]'::jsonb;
