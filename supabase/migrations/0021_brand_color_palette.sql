-- Expands the 2-color brand palette (0020_brand_colors.sql) to a full 4-color palette — two
-- colors made every AI-designed landing page look too plain/two-tone. Adds accent and
-- outline/border colors so the generator has real range (buttons vs. borders vs. small accents)
-- instead of reusing the same two colors for everything.

alter table public.brand_voices
  add column if not exists accent_color text not null default '',
  add column if not exists outline_color text not null default '';
