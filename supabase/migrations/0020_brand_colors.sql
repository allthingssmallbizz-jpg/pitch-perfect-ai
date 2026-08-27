-- Adds brand colors to the existing Brand Voice profile (0003_redesign_features.sql) — same
-- one-row-per-user table, same "folded into every generation automatically" pattern. Lets a
-- member set their actual brand hex colors once so the Landing Page generator (and any future
-- visual generator) uses them instead of picking its own accent color every time.

alter table public.brand_voices
  add column if not exists primary_color text not null default '',
  add column if not exists secondary_color text not null default '';
