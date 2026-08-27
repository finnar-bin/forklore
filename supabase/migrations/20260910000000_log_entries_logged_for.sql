-- Splits log_entries' overloaded `logged_by` (which meant both "who it
-- counts against" and, implicitly, "who performed the write," since RLS
-- checked `logged_by = auth.uid()` for every insert/update/delete) into two
-- columns, so a group member can log an entry on another member's behalf:
--   - logged_for: who the entry counts against (renamed from logged_by).
--   - created_by: who actually wrote it (new).
-- Requested directly. See docs/pending-deviations.md for the full writeup.
--
-- ALTER rather than the drop+recreate the prior log_entries migration used
-- (20260909000000) — that one was justified by "no production rows exist
-- yet," which no longer holds now that the app has been live against this
-- shape. created_by is backfilled from logged_for for any existing row,
-- accurate for every row since actor and attribution target were always the
-- same person before this migration existed.

alter table public.log_entries rename column logged_by to logged_for;

alter table public.log_entries add column created_by uuid references public.profiles(id);
update public.log_entries set created_by = logged_for where created_by is null;
alter table public.log_entries alter column created_by set not null;

drop index if exists idx_log_entries_logged_by_date;
create index idx_log_entries_logged_for_date on public.log_entries (logged_for, logged_at);
create index idx_log_entries_created_by on public.log_entries (created_by);

drop policy if exists "read own or group log entries" on public.log_entries;
drop policy if exists "write own or group log entries" on public.log_entries;
drop policy if exists "update own log entries" on public.log_entries;
drop policy if exists "delete own log entries" on public.log_entries;

-- Unchanged in shape (still "attributed to me, or anywhere I'm a member") —
-- recreated only because it references the renamed column.
create policy "read own or group log entries"
on public.log_entries for select
using (
  logged_for = auth.uid()
  or (group_id is not null and group_id in (select group_id from public.group_members where user_id = auth.uid()))
);

-- The actor (created_by) must always be the caller — nobody can forge
-- another user's authorship. logged_for is free to be any fellow member of
-- the target group (the "log for someone else" feature itself), but for a
-- personal entry (group_id null) there's no group to delegate within, so it
-- collapses back to "only for yourself" — same as before this migration.
-- The second `group_id in (...)` clause additionally requires logged_for
-- themselves to actually belong to that group, not just the caller — a
-- caller can't attribute an entry to someone outside the group they're
-- posting it into.
create policy "write for self or group member"
on public.log_entries for insert
with check (
  created_by = auth.uid()
  and (
    (group_id is null and logged_for = auth.uid())
    or (
      group_id is not null
      and group_id in (select group_id from public.group_members where user_id = auth.uid())
      and group_id in (select group_id from public.group_members where user_id = logged_for)
    )
  )
);

-- Reverses the owner-only update/delete policy issue #34 deliberately
-- introduced (schema.md used to call this out explicitly: "log_entries
-- represents an individual's own intake history, unlike ingredients/recipes
-- where any group member can edit is intended"). That reasoning no longer
-- holds once one member can log for another — a group log entry is now a
-- shared-group resource like ingredients/recipes, so any fellow member can
-- correct it (e.g. fix a quantity typo in an entry logged on their behalf).
-- A personal entry (group_id null) has no group to share it with, so it
-- stays owner-only, same as before.
create policy "update own or group log entries"
on public.log_entries for update
using (
  (group_id is null and logged_for = auth.uid())
  or (group_id is not null and group_id in (select group_id from public.group_members where user_id = auth.uid()))
);

create policy "delete own or group log entries"
on public.log_entries for delete
using (
  (group_id is null and logged_for = auth.uid())
  or (group_id is not null and group_id in (select group_id from public.group_members where user_id = auth.uid()))
);
