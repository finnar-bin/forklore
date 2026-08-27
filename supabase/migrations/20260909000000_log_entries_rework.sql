-- Reworks log_entries away from "snapshot everything at creation time,
-- frozen forever" toward a live-reference model: an entry stores a
-- quantity plus a reference to its source ingredient/recipe, and
-- name/kcal/unit are refreshed from that source's *current* data whenever
-- the entry is created or its quantity is edited, instead of being copied
-- once and left to drift from later corrections to the source. Requested
-- directly. See docs/pending-deviations.md for the full writeup and the
-- product decisions this was built against.
--
-- No production rows exist in this table yet (confirmed directly), so this
-- is a straight drop+recreate rather than a column-by-column ALTER
-- migration — cleaner than accreting renames on top of the snapshot_*
-- naming this replaces. `drop table ... cascade` also drops this table's
-- indexes and RLS policies, all restated below exactly as they stood
-- before this migration (schema.md's already-updated RLS section, the
-- Ticket 12 / issue #34 owner-only fixes) — this migration changes column
-- shape only, not access control. The two RLS policies that were altered
-- in place back in issue #34 (update/delete, made owner-only) are
-- recreated here under new, accurate names ("update own log entries" /
-- "delete own log entries") rather than keeping their old "... or group ..."
-- names, which have described a policy that no longer matches its name
-- since that fix.

drop table if exists public.log_entries cascade;

create table public.log_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  logged_by uuid not null references public.profiles(id),
  -- Soft references, same on-delete behavior as before: deleting the
  -- source detaches the entry (FK goes null) rather than deleting it.
  -- Once both are null, name/kcal/quantity/unit below are permanently
  -- frozen at their last-refreshed values — the app disables further
  -- editing of those fields at that point (meal_type and delete still
  -- work). See EditLogEntryDialog.tsx.
  source_ingredient_id uuid references public.ingredients(id) on delete set null,
  source_recipe_id uuid references public.recipes(id) on delete set null,
  -- Refreshed from the current source's name / (kcal-per-unit * quantity)
  -- whenever the entry is created or its quantity is edited — not a
  -- creation-time-only snapshot. These remain the values actually used for
  -- calorie math, and become the permanent last-known values once the
  -- source is detached above.
  name text not null,
  kcal numeric not null,
  quantity numeric not null,
  unit ingredient_unit not null,
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  logged_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_log_entries_logged_by_date on public.log_entries (logged_by, logged_at);
create index idx_log_entries_group_date on public.log_entries (group_id, logged_at);

alter table public.log_entries enable row level security;

create policy "read own or group log entries"
on public.log_entries for select
using (
  logged_by = auth.uid()
  or (group_id is not null and group_id in (select group_id from public.group_members where user_id = auth.uid()))
);

create policy "write own or group log entries"
on public.log_entries for insert
with check (
  logged_by = auth.uid()
  and (group_id is null or group_id in (select group_id from public.group_members where user_id = auth.uid()))
);

create policy "update own log entries"
on public.log_entries for update
using (logged_by = auth.uid());

create policy "delete own log entries"
on public.log_entries for delete
using (logged_by = auth.uid());
