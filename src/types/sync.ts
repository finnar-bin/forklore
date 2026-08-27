export type OutboxStatus = "pending" | "waiting_for_connectivity" | "failed";

export interface OutboxItem {
  id: string;
  table: string;
  operation: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  status: OutboxStatus;
  error?: string;
  created_at: string;
}

// sync/pull.ts's per-table "last pulled changes since" cursor, keyed e.g.
// "ingredients:personal" or "ingredients:group:<id>" — one row per table x
// scope, since a personal pull and a group pull progress independently.
export interface SyncMetaEntry {
  key: string;
  value: string;
}
