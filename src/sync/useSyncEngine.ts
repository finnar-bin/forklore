import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useSyncStore } from '../store/useSyncStore';
import { fetchMyGroups } from '../features/groups/api';
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

  useEffect(() => {
    if (!userId) return;
    const currentUserId = userId;

    let cancelled = false;

    async function runPull() {
      // Personal scope, plus every group the caller currently belongs to —
      // not just whichever one is being actively viewed (Ticket 12's
      // original scoping). The log entry dialog (Ticket 12 follow-up, "/log
      // shows everything") lets the user log any ingredient/recipe from any
      // of their groups regardless of which screen they're on, so Dexie
      // needs all of them available locally, not just the group currently
      // on screen. Membership is refetched each cycle so a newly joined
      // group starts pulling without needing a full reload. Each scope's
      // failure (e.g. offline) doesn't block the others.
      const groups = await fetchMyGroups(currentUserId).catch(() => []);
      const scopes: PullScope[] = [
        { userId: currentUserId, groupId: null },
        ...groups.map((membership) => ({ userId: currentUserId, groupId: membership.group.id })),
      ];

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
  }, [userId]);
}
