-- Optional meal-of-the-day categorization for log_entries — requested
-- directly, so /log and /groups/:groupId/log can group today's entries
-- into breakfast/lunch/dinner/snack sections.
--
-- Nullable, no default: existing rows and any entry logged without picking
-- a meal stay uncategorized rather than defaulting to one.
alter table public.log_entries
  add column meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack'));
