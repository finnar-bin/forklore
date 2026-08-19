import { create } from 'zustand';

// Session + active group context — see frontend-architecture.md "Zustand stores".
// `onboardingComplete` is a Ticket 5 addition beyond that doc's AppState shape —
// see docs/pending-deviations.md (Ticket 5). null = not yet checked, otherwise
// mirrors whether profiles.height_cm is set for the current user.
interface AppState {
  userId: string | null;
  activeGroupId: string | null; // null = personal context
  onboardingComplete: boolean | null;
  setSession: (userId: string | null) => void;
  setActiveGroup: (groupId: string | null) => void;
  setOnboardingComplete: (complete: boolean | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userId: null,
  activeGroupId: null,
  onboardingComplete: null,
  // Resets onboardingComplete only when the user actually changes (login,
  // logout, or switching accounts on the same device) — a same-user
  // auth-state event (e.g. token refresh) must not re-trigger the check.
  setSession: (userId) =>
    set((state) => (state.userId === userId ? state : { userId, onboardingComplete: null })),
  setActiveGroup: (activeGroupId) => set({ activeGroupId }),
  setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
}));
