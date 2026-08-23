import { useEffect } from 'react';
import { create } from 'zustand';
import { fetchWeightLogs } from './api';
import type { WeightLog } from '../../types/weight';

interface CacheState {
  userId: string | null;
  logs: WeightLog[] | undefined;
  error: boolean;
  inflight: Promise<void> | null;
}

interface CacheActions {
  ensureLoaded: (userId: string) => void;
  invalidate: () => void;
  addLog: (log: WeightLog) => void;
}

// Shared cache, same shape as useMyProfile.ts — Progress is a BottomNav tab
// root, and AnimatedAppShell fully unmounts/remounts a route's component
// tree on every navigation (LogPage.tsx documents this same class of
// problem: "Log is a BottomNav tab and remounts on every tap"). Without a
// shared cache, leaving and returning to Progress within a session would
// refetch the caller's entire weight history every time.
const useWeightLogsCacheStore = create<CacheState & CacheActions>((set, get) => ({
  userId: null,
  logs: undefined,
  error: false,
  inflight: null,

  ensureLoaded: (userId) => {
    const state = get();
    if (state.userId === userId && (state.logs !== undefined || state.error || state.inflight)) return;
    const inflight = fetchWeightLogs(userId)
      .then((logs) => {
        set({ userId, logs, error: false, inflight: null });
      })
      .catch(() => {
        set({ userId, logs: undefined, error: true, inflight: null });
      });
    set({ userId, logs: undefined, error: false, inflight });
  },

  invalidate: () => set({ logs: undefined, error: false, inflight: null }),

  // Appends optimistically after a successful insert rather than
  // refetching the whole list — the new row is always the newest (
  // `logged_at` defaults to current_date), so it belongs at the end.
  addLog: (log) => set((state) => ({ logs: state.logs ? [...state.logs, log] : [log] })),
}));

export function useWeightLogs(userId: string | null): WeightLog[] | undefined {
  const logs = useWeightLogsCacheStore((state) => (state.userId === userId ? state.logs : undefined));
  const error = useWeightLogsCacheStore((state) => (state.userId === userId ? state.error : false));
  const inflight = useWeightLogsCacheStore((state) => (state.userId === userId ? state.inflight : null));

  useEffect(() => {
    if (userId && logs === undefined && !error && !inflight) {
      useWeightLogsCacheStore.getState().ensureLoaded(userId);
    }
  }, [userId, logs, error, inflight]);

  return logs;
}

export function useWeightLogsLoadError(userId: string | null): boolean {
  return useWeightLogsCacheStore((state) => (state.userId === userId ? state.error : false));
}

export function invalidateWeightLogs(): void {
  useWeightLogsCacheStore.getState().invalidate();
}

// Called after a successful logWeight (see LogWeightDialog) so every
// mounted useWeightLogs reader picks up the new entry immediately.
export function addWeightLog(log: WeightLog): void {
  useWeightLogsCacheStore.getState().addLog(log);
}
