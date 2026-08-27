import { db } from '../../lib/db';
import { enqueueMutation } from '../../sync/outbox';
import type { IngredientUnit } from '../../types/ingredient';
import type { LogEntry, MealType } from '../../types/log';

export interface LogEntryInput {
  source_ingredient_id: string | null;
  source_recipe_id: string | null;
  name: string;
  kcal: number;
  quantity: number;
  unit: IngredientUnit;
  meal_type: MealType | null;
}

// Local (not UTC) calendar date — logged_at is a plain `date` column and
// "today" should mean the user's wall-clock day, not the server's.
export function todayLocalDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Reads come from Dexie, not Supabase — see frontend-architecture.md
// "Offline sync — outbox pattern". `groupId: null` is the cross-context
// "today" view — everything the caller logged today, personal and every
// group combined, same query shape as fetchAllLogEntries below (Ticket 12
// follow-up, "/log shows everything"); a group id instead shows that one
// group's shared log — every entry logged into it by any member, per
// schema.md's "filter by group_id for the group view" note.
//
// A prior version of this queried `logged_by anyOf (this group's member
// ids)` instead, with no group_id filter at all, intending to show every
// member's own entries regardless of context. Reverted (code-reviewer
// pass): `log_entries`' own RLS policy only grants visibility into a row
// where `logged_by = auth.uid()` OR `group_id` is one of the caller's own
// groups — it has no clause for "a fellow group member's entry in a
// context I don't otherwise have access to." Combined with the sync
// engine (src/sync/pull.ts) only ever pulling "my personal entries" and
// "this one group's entries" per scope, that version couldn't actually
// surface other members' personal/other-group entries at all, while
// letting the *viewer's own* personal/other-group entries (already
// present locally) leak into every group's log unconditionally. See
// docs/pending-deviations.md.
export async function fetchTodayLogEntries(userId: string, groupId: string | null): Promise<LogEntry[]> {
  const today = todayLocalDate();
  const rows =
    groupId === null
      ? await db.log_entries.where('logged_by').equals(userId).toArray()
      : await db.log_entries.where('group_id').equals(groupId).toArray();
  return rows.filter((e) => e.logged_at === today).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// /logs (all-time, cross-context): queries by logged_by only, no group_id
// filter, by design — see schema.md/routes.md ("everything the user has
// logged, personal and every group combined"). Fixed in Ticket 12 — this
// previously also filtered to group_id === null, which happened to look
// correct only because no group entries existed yet (see
// docs/pending-deviations.md, Ticket 12).
export async function fetchAllLogEntries(userId: string): Promise<LogEntry[]> {
  const rows = await db.log_entries.where('logged_by').equals(userId).toArray();
  return rows.sort(
    (a, b) => b.logged_at.localeCompare(a.logged_at) || b.created_at.localeCompare(a.created_at),
  );
}

// /groups/:groupId/logs — a single group's own all-time history, same
// "every entry logged into it by any member" shape as the group branch of
// fetchTodayLogEntries above, just without the "today" filter. See
// docs/pending-deviations.md (Ticket 12 follow-up, "group's all-time history").
export async function fetchAllGroupLogEntries(groupId: string): Promise<LogEntry[]> {
  const rows = await db.log_entries.where('group_id').equals(groupId).toArray();
  return rows.sort(
    (a, b) => b.logged_at.localeCompare(a.logged_at) || b.created_at.localeCompare(a.created_at),
  );
}

// Writes go to Dexie immediately (optimistic UI), then queue to the outbox
// for Supabase — see frontend-architecture.md "Offline sync — outbox pattern".
export async function createLogEntry(
  userId: string,
  groupId: string | null,
  input: LogEntryInput,
): Promise<LogEntry> {
  const now = new Date().toISOString();
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    group_id: groupId,
    logged_by: userId,
    ...input,
    logged_at: todayLocalDate(),
    created_at: now,
    updated_at: now,
  };
  await db.log_entries.add(entry);
  await enqueueMutation('log_entries', 'insert', { ...entry });
  return entry;
}

export interface LogEntryUpdateInput {
  name: string;
  kcal: number;
  quantity: number;
  unit: IngredientUnit;
  meal_type: MealType | null;
}

// Fast-follow mentioned (but explicitly out of scope) in Ticket 8: editing an
// already-logged entry. `source_ingredient_id`/`source_recipe_id` and
// `logged_at` are left alone — this edits the log entry itself, not what it
// was logged from. `name`/`kcal`/`unit` are re-derived by the caller
// (EditLogEntryDialog) from the entry's current source before this is
// called, when a source still exists — see docs/schema.md's
// "live-referenced, not snapshotted" note.
export async function updateLogEntry(id: string, input: LogEntryUpdateInput): Promise<LogEntry> {
  const updated_at = new Date().toISOString();
  await db.log_entries.update(id, { ...input, updated_at });
  const entry = await db.log_entries.get(id);
  if (!entry) throw new Error('Log entry not found.');
  await enqueueMutation('log_entries', 'update', { id, ...input, updated_at });
  return entry;
}

export async function deleteLogEntry(id: string): Promise<void> {
  await db.log_entries.delete(id);
  await enqueueMutation('log_entries', 'delete', { id });
}
