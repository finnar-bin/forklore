import Dexie, { type EntityTable } from "dexie";
import type { Profile } from "../types/profile";
import type { Group } from "../types/group";
import type { Ingredient } from "../types/ingredient";
import type { Recipe } from "../types/recipe";
import type { LogEntry } from "../types/log";
import type { OutboxItem, SyncMetaEntry } from "../types/sync";

// See frontend-architecture.md "Dexie schema" — source of truth when offline.
const db = new Dexie("calorie-app") as Dexie & {
  profiles: EntityTable<Profile, "id">;
  groups: EntityTable<Group, "id">;
  ingredients: EntityTable<Ingredient, "id">;
  recipes: EntityTable<Recipe, "id">;
  log_entries: EntityTable<LogEntry, "id">;
  outbox: EntityTable<OutboxItem, "id">;
  sync_meta: EntityTable<SyncMetaEntry, "key">;
};

db.version(1).stores({
  profiles: "id",
  groups: "id, owner_id",
  ingredients: "id, group_id, created_by, updated_at",
  recipes: "id, group_id, created_by, updated_at",
  log_entries: "id, group_id, logged_by, logged_at",
  outbox: "id, created_at",
});

// outbox.ts queries by status (draining `pending`/`waiting_for_connectivity`
// items, counting `failed` ones) — needs an index, not just id/created_at.
db.version(2).stores({
  outbox: "id, created_at, status",
});

// sync/pull.ts's per-table "changes since last sync" cursor — not in
// frontend-architecture.md's Dexie schema sample. See docs/pending-deviations.md
// (Ticket 10).
db.version(3).stores({
  sync_meta: "key",
});

// log_entries' logged_by -> logged_for rename plus its new created_by
// column ("log for a fellow group member" — see docs/pending-deviations.md
// and supabase/migrations/20260910000000_log_entries_logged_for.sql).
//
// Needs an explicit .upgrade() transform, not just a `.stores()` reindex —
// a pre-existing local row still has a `logged_by` property and no
// `logged_for`/`created_by` at all, and sync/pull.ts's cursor
// (`gt(cursorColumn, lastSyncedAt)`) will *not* naturally re-fetch and
// overwrite it just because this version bumped: that row's `updated_at`
// on the server hasn't changed, so it falls outside every future pull's
// range until something else happens to touch it. Without this transform
// such a row would simply vanish from every `logged_for`-keyed query
// (fetchTodayLogEntries', fetchAllGroupLogEntries', reconcileDeletes) — not
// corrupted, just silently unqueryable — until it happens to be updated
// server-side again. Mirrors the server migration's own backfill
// (`created_by = logged_for`) exactly.
db.version(4)
  .stores({
    log_entries: "id, group_id, logged_for, created_by, logged_at",
  })
  .upgrade(async (tx) => {
    await tx
      .table("log_entries")
      .toCollection()
      .modify((entry) => {
        if ("logged_by" in entry) {
          entry.logged_for = entry.logged_by;
          delete entry.logged_by;
        }
        if (entry.created_by === undefined) {
          entry.created_by = entry.logged_for;
        }
      });
  });

export { db };
