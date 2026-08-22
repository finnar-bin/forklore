import { useEffect } from 'react';
import { create } from 'zustand';

// Session + active group context — see frontend-architecture.md "Zustand stores".
// `onboardingComplete` is a Ticket 5 addition beyond that doc's AppState shape —
// see docs/pending-deviations.md (Ticket 5). null = not yet checked, otherwise
// mirrors whether profiles.daily_kcal_target is set for the current user.
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

// Ticket 12: mirrors the current screen's `:groupId` route param (undefined
// on a personal route, per routes.md's documented pattern) into the store's
// `activeGroupId` so cross-cutting consumers that aren't rendered inside the
// route tree — useSyncEngine, in particular — know which scope is currently
// being viewed. The route param stays the source of truth for rendering
// (returned here, and threaded down as a prop by the caller); the store
// value is a side effect of it, not a second source of truth.
export function useSyncedActiveGroupId(routeGroupId: string | undefined): string | null {
  const groupId = routeGroupId ?? null;
  const setActiveGroup = useAppStore((state) => state.setActiveGroup);
  useEffect(() => {
    setActiveGroup(groupId);
  }, [groupId, setActiveGroup]);
  return groupId;
}
