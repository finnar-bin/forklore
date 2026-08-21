import { db } from '../lib/db';
import { supabase } from '../lib/supabase';
import { useSyncStore } from '../store/useSyncStore';
import type { OutboxItem } from '../types/sync';

// See frontend-architecture.md "Offline sync — outbox pattern".
const MAX_RETRY_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

// Codes that will fail identically on every retry (RLS denial, malformed/invalid
// data) — worth distinguishing from connectivity blips, which are worth retrying.
const PERMANENT_ERROR_CODES = new Set([
  '42501', // insufficient_privilege (RLS denial)
  '23502', // not_null_violation
  '23503', // foreign_key_violation
  '23505', // unique_violation
  '23514', // check_violation
  '22P02', // invalid_text_representation (malformed input, e.g. bad UUID)
]);

function isPermanentError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return !!code && PERMANENT_ERROR_CODES.has(code);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function syncItem(item: OutboxItem): Promise<void> {
  const { table, operation, payload } = item;

  if (operation === 'insert') {
    const { error } = await supabase.from(table).insert(payload);
    if (error) throw error;
    return;
  }

  const { id, ...rest } = payload;
  if (operation === 'update') {
    const { error } = await supabase.from(table).update(rest).eq('id', id as string);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from(table).delete().eq('id', id as string);
  if (error) throw error;
}

// Tracks mutations currently in a retry chain (including ones waiting out a
// backoff delay) so useSyncStore reflects "still working on it" accurately.
let activeAttempts = 0;

function beginAttempt(): void {
  activeAttempts += 1;
  useSyncStore.getState().setStatus('syncing');
}

async function endAttempt(): Promise<void> {
  activeAttempts -= 1;
  if (activeAttempts > 0) return;
  const failedCount = await db.outbox.where('status').equals('failed').count();
  useSyncStore.getState().setStatus(failedCount > 0 ? 'error' : 'idle');
}

async function drainOutboxWithRetry(item: OutboxItem, attempt = 0): Promise<void> {
  if (attempt === 0) beginAttempt();

  try {
    await syncItem(item);
    await db.outbox.delete(item.id);
    await endAttempt();
  } catch (err) {
    if (isPermanentError(err)) {
      await db.outbox.update(item.id, { status: 'failed', error: errorMessage(err) });
      await endAttempt();
      return;
    }

    if (attempt >= MAX_RETRY_ATTEMPTS) {
      await db.outbox.update(item.id, { status: 'waiting_for_connectivity' });
      await endAttempt();
      return;
    }

    const delayMs = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
    setTimeout(() => {
      void drainOutboxWithRetry(item, attempt + 1);
    }, delayMs);
  }
}

export async function enqueueMutation(
  table: string,
  operation: OutboxItem['operation'],
  payload: Record<string, unknown>,
): Promise<string> {
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    table,
    operation,
    payload,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  await db.outbox.add(item);
  void drainOutboxWithRetry(item);
  return item.id;
}

// Re-attempts anything already sitting in the outbox as `pending` from a
// previous session (e.g. the tab closed mid-backoff). Safe to call repeatedly.
export async function drainPendingOutbox(): Promise<void> {
  const items = await db.outbox.where('status').equals('pending').sortBy('created_at');
  items.forEach((item) => void drainOutboxWithRetry(item));
}

async function retryWaitingForConnectivity(): Promise<void> {
  const items = await db.outbox.where('status').equals('waiting_for_connectivity').toArray();
  items.forEach((item) => void drainOutboxWithRetry(item));
}

window.addEventListener('online', () => void retryWaitingForConnectivity());
