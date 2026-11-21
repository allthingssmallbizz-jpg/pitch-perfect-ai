-- Pitch Perfect Express™: the member's intake answers are saved on the project as they type
-- (auto-save plus a Save button), so nothing is lost if a generation fails, the page reloads, or
-- they come back later on another device.
alter table public.projects add column if not exists express_brief jsonb;
