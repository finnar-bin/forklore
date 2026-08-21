-- log_entries had no delete policy (same gap as recipes before Ticket 2's
-- fix — schema.md only specifies select/insert/update for this table).
-- Needed by Ticket 8's fast-follow: deleting an already-logged entry.
-- Mirrors the shape of "delete own or group ingredients" / the existing
-- log_entries update policy.

create policy "delete own or group log entries"
on public.log_entries for delete
using (
  logged_by = auth.uid()
  or (group_id is not null and group_id in (select group_id from public.group_members where user_id = auth.uid()))
);
