import { create } from 'zustand';

// Sync status for UI feedback — see frontend-architecture.md "Zustand stores".
interface SyncState {
  status: 'idle' | 'syncing' | 'error';
  lastSyncedAt: string | null;
  setStatus: (status: SyncState['status']) => void;
  setLastSynced: (timestamp: string) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  setStatus: (status) => set({ status }),
  setLastSynced: (lastSyncedAt) => set({ lastSyncedAt }),
}));
