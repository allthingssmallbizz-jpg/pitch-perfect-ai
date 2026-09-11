-- Lets an admin demo the platform live (a webinar, a sales call) without being blocked by the
-- same bio/discovery completeness gates every member hits — Aaron only has so many minutes on a
-- webinar and can't stop to fill out a 24-question discovery brief on stage. A single global
-- switch (like kill_switch_enabled below, which this deliberately mirrors), not a per-admin
-- setting: there's no meaningful case for one admin wanting it on while another wants it off.
--
-- Scoped to admins only, everywhere it's checked in application code (never touches what a
-- regular member sees or is blocked by, regardless of this flag's state) — this column just
-- stores whether the switch is currently flipped, not who it applies to.
alter table public.admin_settings
  add column if not exists admin_restrictions_disabled boolean not null default false;
