import { db } from '../lib/db';
import { supabase } from '../lib/supabase';

// Pull side of the outbox pattern — see frontend-architecture.md "Offline
// sync — outbox pattern", step 4. Fetches rows changed since the last pull
// per table and merges them into Dexie via bulkPut (last-write-wins, per the
// same doc section — no client-side conflict resolution beyond that).
//
// Written generically over a `scope` (personal vs. a specific group) rather
// than hardcoding `group_id is null` so Ticket 12 can reuse this unchanged
// for group-scoped pulls — see this ticket's "Out of scope" note.
export interface PullScope {
  groupId: string | null;
  userId: string;
}

interface TableSyncConfig {
  table: 'ingredients' | 'recipes' | 'log_entries';
  // Column compared against the last-synced cursor.
  cursorColumn: 'updated_at' | 'created_at';
  // Column that identifies "this row is personal to the caller" when
  // `scope.groupId` is null. Group-scoped rows (Ticket 12) rely on RLS
  // membership instead, so this column isn't filtered on in that case.
  ownerColumn: 'created_by' | 'logged_by';
}

async function getCursor(metaKey: string): Promise<string | null> {
  const entry = await db.sync_meta.get(metaKey);
  return entry?.value ?? null;
}

async function setCursor(metaKey: string, value: string): Promise<void> {
  await db.sync_meta.put({ key: metaKey, value });
}

function scopeKey(table: string, scope: PullScope): string {
  return scope.groupId === null ? `${table}:personal:${scope.userId}` : `${table}:group:${scope.groupId}`;
}

async function pullTable(config: TableSyncConfig, scope: PullScope): Promise<void> {
  const metaKey = scopeKey(config.table, scope);
  const lastSyncedAt = await getCursor(metaKey);
  // Captured before the request goes out, not after it resolves — a write
  // that lands mid-request is safer to see again on the *next* pull (a no-op
  // bulkPut) than to miss because it fell after the response but before this
  // timestamp was recorded.
  const syncStartedAt = new Date().toISOString();

  let query = supabase.from(config.table).select('*');
  query =
    scope.groupId === null
      ? query.is('group_id', null).eq(config.ownerColumn, scope.userId)
      : query.eq('group_id', scope.groupId);
  if (lastSyncedAt) {
    query = query.gt(config.cursorColumn, lastSyncedAt);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (data && data.length > 0) {
    // db.table() is untyped (Table<any, any>) — bulkPut accepts the raw rows
    // as-is, same shape Dexie's own typed EntityTable would expect.
    await db.table(config.table).bulkPut(data);
  }
  await setCursor(metaKey, syncStartedAt);
}

const TABLE_CONFIGS: TableSyncConfig[] = [
  { table: 'ingredients', cursorColumn: 'updated_at', ownerColumn: 'created_by' },
  { table: 'recipes', cursorColumn: 'updated_at', ownerColumn: 'created_by' },
  { table: 'log_entries', cursorColumn: 'updated_at', ownerColumn: 'logged_by' },
];

// Pulls every table for one scope (personal, or — once Ticket 12 lands — a
// specific group). Runs the three tables concurrently; one table's failure
// (e.g. offline) doesn't block the others from progressing.
export async function pullScope(scope: PullScope): Promise<void> {
  const results = await Promise.allSettled(TABLE_CONFIGS.map((config) => pullTable(config, scope)));
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) throw failed.reason;
}
