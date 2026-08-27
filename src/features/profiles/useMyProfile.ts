import { useEffect } from "react";
import { create } from "zustand";
import { fetchMyProfile } from "./api";
import type { Profile } from "../../types/profile";

interface CacheState {
  userId: string | null;
  profile: Profile | undefined;
  // Distinct from `profile === undefined` (still loading) — a fetch failure
  // must leave the cache in a state the dedup guard below treats as
  // "resolved," or every mounted consumer's effect re-fires ensureLoaded on
  // its next render with nothing to actually break the loop (see the fix
  // note below).
  error: boolean;
  inflight: Promise<void> | null;
}

interface CacheActions {
  ensureLoaded: (userId: string) => void;
  invalidate: () => void;
}

// Shared cache for "my own profile row", same shape as useMyGroups.ts — the
// caller's own profile is read by both AppHeader (avatar icon, rendered on
// every tab-root screen) and the Profile screen itself. AppHeader's host
// route fully unmounts/remounts on every navigation (AnimatedAppShell's own
// comment), so without a shared cache the avatar icon would refetch on every
// tab switch — the same class of bug just fixed for group_members
// (docs/pending-deviations.md, Ticket 16's "repeated fetches" note).
const useProfileCacheStore = create<CacheState & CacheActions>((set, get) => ({
  userId: null,
  profile: undefined,
  error: false,
  inflight: null,

  ensureLoaded: (userId) => {
    const state = get();
    if (
      state.userId === userId &&
      (state.profile !== undefined || state.error || state.inflight)
    )
      return;
    // Swallows a fetch failure rather than rethrowing — nothing awaits this
    // promise besides the dedup check above, so an unhandled rejection would
    // otherwise surface with no consumer able to catch it. Caches `error:
    // true` (a defined, stable state, mirroring useMyGroups' `[]` fallback)
    // rather than just leaving `profile: undefined` — an earlier version of
    // this did exactly that, which is indistinguishable from "never
    // fetched," so every mounted useMyProfile's effect (keyed on
    // profile/inflight both being falsy) re-triggered ensureLoaded on its own
    // next render with no backoff, retrying forever. `invalidate()` is the
    // only way out of the error state now.
    const inflight = fetchMyProfile(userId)
      .then((profile) => {
        set({ userId, profile, error: false, inflight: null });
      })
      .catch(() => {
        set({ userId, profile: undefined, error: true, inflight: null });
      });
    set({ userId, profile: undefined, error: false, inflight });
  },

  invalidate: () => set({ profile: undefined, error: false, inflight: null }),
}));

// Read-only hook: returns the cached profile (undefined while loading or on
// error), fetching once per userId and automatically re-fetching if
// invalidateMyProfile() is called while mounted (e.g. after a profile edit).
export function useMyProfile(userId: string | null): Profile | undefined {
  const profile = useProfileCacheStore((state) =>
    state.userId === userId ? state.profile : undefined,
  );
  const error = useProfileCacheStore((state) =>
    state.userId === userId ? state.error : false,
  );
  const inflight = useProfileCacheStore((state) =>
    state.userId === userId ? state.inflight : null,
  );

  useEffect(() => {
    if (userId && profile === undefined && !error && !inflight) {
      useProfileCacheStore.getState().ensureLoaded(userId);
    }
  }, [userId, profile, error, inflight]);

  return profile;
}

// Lets the Profile screen distinguish "still loading" from "failed to load"
// (both otherwise read as `profile === undefined` from the hook above) so it
// can show a retry affordance instead of a permanent spinner. AppHeader's
// avatar icon doesn't need this distinction — it falls back to the same
// placeholder tile either way.
export function useMyProfileLoadError(userId: string | null): boolean {
  return useProfileCacheStore((state) =>
    state.userId === userId ? state.error : false,
  );
}

// Called after a successful updateMyProfile (see api.ts) so every mounted
// useMyProfile reader (the Profile screen itself, plus AppHeader's avatar
// icon) picks up the change, and after a retry request from the error state
// above.
export function invalidateMyProfile(): void {
  useProfileCacheStore.getState().invalidate();
}
