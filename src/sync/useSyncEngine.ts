import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useSyncStore } from '../store/useSyncStore';
import { drainPendingOutbox } from './outbox';
import { pullScope, type PullScope } from './pull';

// Not specified by any doc — 60s balances catching another-device's changes
// reasonably promptly against not hammering Supabase while the tab is just
// sitting open. See docs/pending-deviations.md (Ticket 10).
const PULL_INTERVAL_MS = 60_000;

// Drives the pull side of the outbox pattern for the whole app: an initial
// pull (and outbox resume) on login, a periodic re-pull while the tab is
// open, and an immediate re-pull on reconnect — mirroring outbox.ts's own
// `online` listener for the push side.
export function useSyncEngine(): void {
  const userId = useAppStore((state) => state.userId);
  const activeGroupId = useAppStore((state) => state.activeGroupId);

  useEffect(() => {
    if (!userId) return;
    const currentUserId = userId;

    let cancelled = false;

    async function runPull() {
      // Personal scope is always pulled — screens outside the active group
      // context (the /logs cross-context view, switching back to Personal)
      // still read whatever Dexie already has, so it shouldn't go stale just
      // because the user is currently looking at a group. The active
      // group's scope (Ticket 12) is pulled alongside it, not instead of it.
      // Each scope's failure (e.g. offline) doesn't block the other.
      const scopes: PullScope[] = [{ userId: currentUserId, groupId: null }];
      if (activeGroupId) scopes.push({ userId: currentUserId, groupId: activeGroupId });

      const results = await Promise.allSettled(scopes.map((scope) => pullScope(scope)));
      if (!cancelled && results.some((r) => r.status === 'fulfilled')) {
        useSyncStore.getState().setLastSynced(new Date().toISOString());
      }
    }

    void drainPendingOutbox();
    void runPull();

    const intervalId = setInterval(() => void runPull(), PULL_INTERVAL_MS);
    const handleOnline = () => void runPull();
    window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
    };
  }, [userId, activeGroupId]);
}
