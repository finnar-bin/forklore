export type OutboxStatus = 'pending' | 'waiting_for_connectivity' | 'failed';

export interface OutboxItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  status: OutboxStatus;
  error?: string;
  created_at: string;
}
