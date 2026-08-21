-- recipes had no delete policy (same gap ingredients/log_entries had before
-- Ticket 2/8's fixes — schema.md only specifies select/insert/update for
-- this table). Needed to add a "delete recipe" feature, missing since
-- Ticket 7 (see docs/pending-deviations.md).
-- Mirrors the shape of the existing recipes select/insert/update policies.

create policy "delete own or group recipes"
on public.recipes for delete
using (
  (group_id is null and created_by = auth.uid())
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
);
