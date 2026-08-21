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
// Mapped to a user-facing explanation — surfaced on /sync-status, so these must
// read as plain language, not a raw Postgres/PostgREST error string.
const PERMANENT_ERROR_MESSAGES: Record<string, string> = {
  '42501': "You don't have permission to make this change.", // insufficient_privilege (RLS denial)
  '23502': 'Some required information is missing.', // not_null_violation
  '23503': 'This refers to something that no longer exists.', // foreign_key_violation
  '23505': 'This already exists.', // unique_violation
  '23514': "This change doesn't meet the app's rules.", // check_violation
  '22P02': 'This change contains invalid data.', // invalid_text_representation (e.g. malformed UUID)
};

function isPermanentError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return !!code && code in PERMANENT_ERROR_MESSAGES;
}

function describeError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  if (code && code in PERMANENT_ERROR_MESSAGES) return PERMANENT_ERROR_MESSAGES[code];
  return "Couldn't save this change. Check your connection and try again.";
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

// Item ids currently mid-drain — guards against the same item being synced
// twice concurrently (e.g. the browser firing `online` more than once for a
// single reconnect, which happens in practice, not just in DevTools).
const draining = new Set<string>();

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
  if (attempt === 0) {
    if (draining.has(item.id)) return;
    draining.add(item.id);
    beginAttempt();
  }

  try {
    await syncItem(item);
    await db.outbox.delete(item.id);
    draining.delete(item.id);
    await endAttempt();
  } catch (err) {
    if (isPermanentError(err)) {
      await db.outbox.update(item.id, { status: 'failed', error: describeError(err) });
      draining.delete(item.id);
      await endAttempt();
      return;
    }

    if (attempt >= MAX_RETRY_ATTEMPTS) {
      await db.outbox.update(item.id, { status: 'waiting_for_connectivity' });
      draining.delete(item.id);
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

// Manual, single-shot retry for a `failed` item, driven by the /sync-status
// screen's "Retry now" action. A `failed` item never re-enters the automatic
// backoff chain on its own — retrying it is always something the user asked
// for, never a silent background attempt.
export async function retryFailedItem(itemId: string): Promise<void> {
  if (draining.has(itemId)) return;
  const item = await db.outbox.get(itemId);
  if (!item) return;

  draining.add(itemId);
  beginAttempt();
  try {
    await syncItem(item);
    await db.outbox.delete(item.id);
  } catch (err) {
    await db.outbox.update(item.id, { status: 'failed', error: describeError(err) });
  } finally {
    draining.delete(itemId);
    await endAttempt();
  }
}

// The /sync-status screen's "Discard" action — accepts the data loss instead
// of continuing to retry a mutation that keeps failing.
export async function discardFailedItem(itemId: string): Promise<void> {
  await db.outbox.delete(itemId);
}

async function retryWaitingForConnectivity(): Promise<void> {
  const items = await db.outbox.where('status').equals('waiting_for_connectivity').toArray();
  items.forEach((item) => void drainOutboxWithRetry(item));
}

window.addEventListener('online', () => void retryWaitingForConnectivity());
