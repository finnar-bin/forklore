import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { useMyGroups } from '../features/groups/useMyGroups';
import { getStoredGroupId, setStoredGroupId } from '../lib/activeGroupStorage';

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
//
// Also restores the last group context from localStorage (see
// activeGroupStorage.ts) when landing on a bare route with no :groupId —
// e.g. after a reload, or navigating back from Progress/Profile, which
// aren't group-aware. Storage is written *only* by ContextSwitcher's own
// explicit pick (both the group and the Personal case) — deliberately not
// here as a passive "routeGroupId is truthy, so persist it" effect. A group
// screen can stay mounted (frozen, mid-exit-animation) briefly after the
// user has already navigated away — see AnimatedAppShell's outgoing/current
// overlap — and an unrelated re-render of that stale instance (e.g. a
// useMyGroups cache update) would re-run this effect and write its old
// :groupId right back over the value the user just cleared. Restoring is
// still safe to do passively here, since it only ever fires for the
// screen that's actually current.
// `tab`/`userId` are omitted by call sites that aren't a ContextSwitcher
// landing screen (LogPage, RecipeDetailPage, IngredientDetailPage) — those
// just want the plain `routeGroupId ?? null` derivation, no restore.
export function useSyncedActiveGroupId(
  routeGroupId: string | undefined,
  tab?: 'pantry' | 'recipes',
  userId?: string | null,
): string | null {
  const navigate = useNavigate();
  const groups = useMyGroups(tab ? (userId ?? null) : null);

  useEffect(() => {
    if (!tab || routeGroupId) return;
    const storedGroupId = getStoredGroupId();
    if (!storedGroupId || groups === undefined) return;
    if (groups.some((membership) => membership.group.id === storedGroupId)) {
      navigate(`/groups/${storedGroupId}/${tab}`, { replace: true });
    } else {
      // Stale — the user no longer belongs to this group.
      setStoredGroupId(null);
    }
  }, [routeGroupId, groups, tab, navigate]);

  return routeGroupId ?? null;
}
