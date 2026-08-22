import { db } from '../../lib/db';
import { enqueueMutation } from '../../sync/outbox';
import type { IngredientUnit } from '../../types/ingredient';
import type { LogEntry } from '../../types/log';

export interface LogEntryInput {
  source_ingredient_id: string | null;
  source_recipe_id: string | null;
  snapshot_name: string;
  snapshot_kcal: number;
  snapshot_quantity: number | null;
  snapshot_unit: IngredientUnit;
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
// schema.md's "filter by group_id for the group view" note. See
// docs/pending-deviations.md (Ticket 12).
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
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    group_id: groupId,
    logged_by: userId,
    ...input,
    logged_at: todayLocalDate(),
    created_at: new Date().toISOString(),
  };
  await db.log_entries.add(entry);
  await enqueueMutation('log_entries', 'insert', { ...entry });
  return entry;
}

export interface LogEntrySnapshotInput {
  snapshot_name: string;
  snapshot_kcal: number;
  snapshot_quantity: number | null;
}

// Fast-follow mentioned (but explicitly out of scope) in Ticket 8: editing an
// already-logged entry's own snapshot values. Only the snapshot fields are
// editable — source_ingredient_id/source_recipe_id and logged_at are left
// alone, since this edits the log entry itself, not what it was logged from.
export async function updateLogEntry(id: string, input: LogEntrySnapshotInput): Promise<LogEntry> {
  await db.log_entries.update(id, input);
  const entry = await db.log_entries.get(id);
  if (!entry) throw new Error('Log entry not found.');
  await enqueueMutation('log_entries', 'update', { id, ...input });
  return entry;
}

export async function deleteLogEntry(id: string): Promise<void> {
  await db.log_entries.delete(id);
  await enqueueMutation('log_entries', 'delete', { id });
}
