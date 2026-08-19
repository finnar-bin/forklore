import { create } from 'zustand';

// Session + active group context — see frontend-architecture.md "Zustand stores".
interface AppState {
  userId: string | null;
  activeGroupId: string | null; // null = personal context
  setSession: (userId: string | null) => void;
  setActiveGroup: (groupId: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userId: null,
  activeGroupId: null,
  setSession: (userId) => set({ userId }),
  setActiveGroup: (activeGroupId) => set({ activeGroupId }),
}));
