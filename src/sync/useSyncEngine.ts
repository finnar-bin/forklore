import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useSyncStore } from '../store/useSyncStore';
import { drainPendingOutbox } from './outbox';
import { pullScope } from './pull';

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
      try {
        await pullScope({ userId: currentUserId, groupId: activeGroupId });
        if (!cancelled) useSyncStore.getState().setLastSynced(new Date().toISOString());
      } catch {
        // Offline or a transient Supabase error — the next interval tick or
        // `online` event tries again. Nothing to surface here: this is a
        // background refresh, not a user-initiated action, and outbox.ts's
        // own status already covers push-side failures that need attention.
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
