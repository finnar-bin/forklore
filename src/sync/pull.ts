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

// Ids with a not-yet-synced outbox item (any status — pending, retrying, or
// even failed) for this table. A row can be locally-cached but genuinely
// absent from serverIds below just because its own insert hasn't landed yet
// (or is mid-backoff, or parked failed) — not because anyone deleted it.
// Only the initial-mount pull awaits drainPendingOutbox (useSyncEngine.ts),
// so a periodic/online-triggered pull can race an in-flight write; excluding
// these ids is what stops reconciliation from deleting a record the user
// just created out from under them.
async function pendingOutboxIds(table: string): Promise<Set<string>> {
  const items = await db.outbox.toArray();
  return new Set(
    items.filter((item) => item.table === table).map((item) => item.payload.id as string),
  );
}

// Shared by reconcileDeletes and pullCommunityIngredients below — both need
// "delete every locally-cached row that's neither on the server nor still
// mid-sync," differing only in how they arrive at serverIds/localRows.
async function deleteStaleLocalRows(
  table: string,
  serverIds: Set<string>,
  localRows: { id: string }[],
): Promise<void> {
  const pendingIds = await pendingOutboxIds(table);
  const staleIds = localRows
    .map((row) => row.id)
    .filter((id) => !serverIds.has(id) && !pendingIds.has(id));
  if (staleIds.length > 0) {
    await db.table(table).bulkDelete(staleIds);
  }
}

// The cursor-based query above can only ever add/refresh rows — a row
// another user hard-deleted server-side never appears in a `gt(cursorColumn,
// ...)` response, so it lingers in Dexie forever (docs/pending-deviations.md,
// "Community pantry" section, "Known limitation, not fixed here"). This
// closes that gap by fetching the full set of ids currently in scope
// (cheap — id-only) and deleting any locally-cached row whose id isn't in
// that set (and isn't still mid-sync, per pendingOutboxIds above). Runs
// every pull rather than being cursor-gated itself, since a delete doesn't
// bump any row's `updated_at` for this query to key off.
async function reconcileDeletes(config: TableSyncConfig, scope: PullScope): Promise<void> {
  let idQuery = supabase.from(config.table).select('id');
  idQuery =
    scope.groupId === null
      ? idQuery.is('group_id', null).eq(config.ownerColumn, scope.userId)
      : idQuery.eq('group_id', scope.groupId);

  const { data, error } = await idQuery;
  if (error) throw error;
  const serverIds = new Set((data ?? []).map((row) => row.id as string));

  const table = db.table(config.table);
  // Mirrors pullTable's own scope filter above, not any particular screen's
  // display query (e.g. log_entries' personal-history view deliberately
  // skips the group_id === null check) — this has to match what was actually
  // pulled into this scope, not how a screen chooses to display it.
  const localRows =
    scope.groupId === null
      ? (await table.where(config.ownerColumn).equals(scope.userId).toArray()).filter(
          (row) => row.group_id === null,
        )
      : await table.where('group_id').equals(scope.groupId).toArray();

  await deleteStaleLocalRows(config.table, serverIds, localRows);
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
  await reconcileDeletes(config, scope);
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

// Community pantry ingredients (docs/pending-deviations.md, "Community
// pantry") aren't owned by a user or a group — they're global, readable by
// every signed-in caller regardless of that user's/any group's opt-in
// switch, since /community-pantry must list all of them for everyone. So
// this pulls unconditionally for every signed-in user (see useSyncEngine.ts),
// rather than being folded into pullScope's per-owner/per-group shape —
// there's no owner column to filter on, and no scope key beyond a single
// fixed one.
export async function pullCommunityIngredients(): Promise<void> {
  const metaKey = 'ingredients:community';
  const lastSyncedAt = await getCursor(metaKey);
  const syncStartedAt = new Date().toISOString();

  let query = supabase.from('ingredients').select('*').eq('is_community', true);
  if (lastSyncedAt) {
    query = query.gt('updated_at', lastSyncedAt);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (data && data.length > 0) {
    await db.ingredients.bulkPut(data);
  }

  // Same reconciliation as pullTable/reconcileDeletes above, but is_community
  // isn't an indexed Dexie field, so this filters in JS instead of via
  // .where(). This scope has no owner/group query to reuse.
  const { data: idData, error: idError } = await supabase
    .from('ingredients')
    .select('id')
    .eq('is_community', true);
  if (idError) throw idError;
  const serverIds = new Set((idData ?? []).map((row) => row.id as string));

  const localRows = await db.ingredients.filter((row) => row.is_community === true).toArray();
  await deleteStaleLocalRows('ingredients', serverIds, localRows);

  await setCursor(metaKey, syncStartedAt);
}
