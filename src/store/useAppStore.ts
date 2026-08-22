import { create } from 'zustand';

// Session state — see frontend-architecture.md "Zustand stores".
// `onboardingComplete` is a Ticket 5 addition beyond that doc's AppState shape —
// see docs/pending-deviations.md (Ticket 5). null = not yet checked, otherwise
// mirrors whether profiles.daily_kcal_target is set for the current user.
interface AppState {
  userId: string | null;
  onboardingComplete: boolean | null;
  setSession: (userId: string | null) => void;
  setOnboardingComplete: (complete: boolean | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userId: null,
  onboardingComplete: null,
  // Resets onboardingComplete only when the user actually changes (login,
  // logout, or switching accounts on the same device) — a same-user
  // auth-state event (e.g. token refresh) must not re-trigger the check.
  setSession: (userId) =>
    set((state) => (state.userId === userId ? state : { userId, onboardingComplete: null })),
  setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
}));

// Ticket 12: mirrors the current screen's `:groupId` route param (undefined
// on a personal route, per routes.md's documented pattern) to the `null`
// shape group-scoped reads/writes expect everywhere else in the app. Used to
// live-write a Zustand `activeGroupId` field for useSyncEngine's benefit —
// dropped (Ticket 12 follow-up, "/log shows everything") once the sync
// engine started pulling every one of the caller's groups instead of just
// whichever one was active, since that was the field's only reader. Kept as
// a hook (rather than inlining `routeGroupId ?? null` at each of
// Pantry/Recipes/LogPage) purely so all three stay in sync if a real
// cross-cutting consumer shows up again.
export function useSyncedActiveGroupId(routeGroupId: string | undefined): string | null {
  return routeGroupId ?? null;
}
