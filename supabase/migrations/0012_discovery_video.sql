-- Optional "how to fill this out" walkthrough video shown at the top of every project's
-- Discovery form. The target membership skews 45-55+ and often has never built a webinar or
-- filled out a marketing discovery brief before — a short video orientation from Aaron himself
-- helps a lot more than another paragraph of on-page text. Admin-editable (not an env var) so
-- it can be turned on/off or swapped any time from /admin without a code change or redeploy.

alter table public.admin_settings
  add column if not exists discovery_video_url text;

comment on column public.admin_settings.discovery_video_url is
  'Optional YouTube/Vimeo URL for a short "how to fill out Discovery" walkthrough video, rendered at the top of every project''s Discovery form when set. Null hides the section entirely.';
