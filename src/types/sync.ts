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
// "ingredients:group:<id>" — one row per table x group, since each group's
// pull progresses independently.
export interface SyncMetaEntry {
  key: string;
  value: string;
}
