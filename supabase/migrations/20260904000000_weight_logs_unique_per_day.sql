-- One weight_logs row per (user, day) — matches the app's intent that
-- editing "today's weight" from /profile updates today's own entry rather
-- than accumulating duplicates (docs/pending-deviations.md, Ticket 17's
-- weight/birthdate follow-up). Without this, saveTodayWeightLog's
-- find-then-update-or-insert had a TOCTOU race (two concurrent saves could
-- each find "no row for today" and both insert), and any duplicate that
-- slipped through broke every later save that day (the find step's
-- .maybeSingle() throws once more than one row matches). A real upsert on
-- this constraint removes both problems at the database level instead of
-- patching around them client-side.
alter table public.weight_logs
  add constraint weight_logs_user_id_logged_at_key unique (user_id, logged_at);
