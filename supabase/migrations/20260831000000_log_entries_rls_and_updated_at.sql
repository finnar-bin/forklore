-- Tightens log_entries UPDATE/DELETE to owner-only. SELECT stays
-- group-inclusive — group members must still see each other's shared log,
-- only edit/delete were bugged: any group member could alter or delete
-- another member's entry. schema.md's "apply the same three-policy shape as
-- ingredients/recipes" instruction (see that doc's RLS policy pattern
-- section) was right for a shared resource like ingredients but wrong here,
-- per log_entries' own description ("individual's own intake history").
-- Resolves the gap already flagged in docs/pending-deviations.md's Ticket 12
-- section ("Not yet verified (RLS gap)").

alter policy "update own or group log entries"
on public.log_entries
using (logged_by = auth.uid());

alter policy "delete own or group log entries"
on public.log_entries
using (logged_by = auth.uid());

-- log_entries has no updated_at, so pull.ts's incremental cursor (falling
-- back to created_at) never re-fetches an edit made on another device — see
-- that file's own comment on the gap. Backfill from created_at, not now(),
-- so historical rows don't all look freshly edited to a fresh pull.
alter table public.log_entries add column updated_at timestamptz;
update public.log_entries set updated_at = created_at;
alter table public.log_entries alter column updated_at set not null;
alter table public.log_entries alter column updated_at set default now();
