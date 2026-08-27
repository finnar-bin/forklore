import { create } from "zustand";
import { useMyGroups } from "../features/groups/useMyGroups";
import { getStoredGroupId } from "../lib/activeGroupStorage";
import { resolveDefaultGroupId } from "../lib/defaultGroup";

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
    set((state) =>
      state.userId === userId ? state : { userId, onboardingComplete: null },
    ),
  setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
}));

// Ticket 12: mirrors the current screen's `:groupId` route param to the
// `null` shape a group-optional read/write expects. Pantry/Recipes/
// RecipeDetailPage no longer need this at all — those routes always carry a
// real :groupId now that every account belongs to a group (see
// docs/pending-deviations.md, "Remove personal mode") — but LogPage (the
// bare, cross-context /log view is a deliberately-kept exception, see that
// file) and IngredientDetailPage (also reached from /community-pantry/:id,
// which has no :groupId at all) still land on a route with no :groupId, so
// this trivial conversion is kept as a named hook for those two call sites.
export function useSyncedActiveGroupId(
  routeGroupId: string | undefined,
): string | null {
  return routeGroupId ?? null;
}

// Where "/" and every non-group-aware screen's back button (SyncStatusPage,
// GroupsPage, CommunityPantryPage, ProfilePage) should land — there's no
// bare /pantry to fall back to anymore (see docs/pending-deviations.md,
// "Remove personal mode"), so this resolves the same default group
// BottomNav falls back to. Returns null only while `groups` hasn't loaded
// yet — callers either show a brief loading state (the "/" redirect) or
// fall back to the always-valid `/groups` list screen (everywhere else).
export function useHomePath(): string | null {
  const userId = useAppStore((state) => state.userId);
  const groups = useMyGroups(userId);
  if (groups === undefined) return null;
  const groupId = resolveDefaultGroupId(groups, getStoredGroupId());
  return groupId ? `/groups/${groupId}/pantry` : "/groups";
}
