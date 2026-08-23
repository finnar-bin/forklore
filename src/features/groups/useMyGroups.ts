import { useEffect } from 'react';
import { create } from 'zustand';
import { fetchMyGroups } from './api';
import type { GroupMembership } from '../../types/group';

interface CacheState {
  userId: string | null;
  groups: GroupMembership[] | undefined;
  inflight: Promise<GroupMembership[]> | null;
}

interface CacheActions {
  ensureLoaded: (userId: string) => void;
  invalidate: () => void;
}

// Shared cache for "groups I belong to" (api.ts's fetchMyGroups, a live
// Supabase read — see docs/pending-deviations.md, Ticket 11, on why this
// isn't mirrored into Dexie). Before Ticket 16, ~8 components each fetched
// this independently on their own mount, tolerable when reaching a second
// one of those screens required typing a URL. Ticket 16's BottomNav makes
// Pantry/Recipes/Log a single tap apart, which turned that same live query
// into something firing on every tab switch. This module gives every
// *read-only* consumer one shared, deduplicated fetch instead.
//
// Deliberately NOT used by RequireGroupMember/RequireGroupOwner (route
// guards that must see a genuinely fresh membership check, not whatever's
// cached from a screen visited minutes ago — see issue #34's audit), by
// GroupSettings (its own fetchMyGroups call doubles as a defense-in-depth
// ownership check for the same reason), or by useSyncEngine (deliberately
// refetches every pull cycle so a newly joined group starts syncing without
// a reload — see that file's own comment).
const useGroupsCacheStore = create<CacheState & CacheActions>((set, get) => ({
  userId: null,
  groups: undefined,
  inflight: null,

  ensureLoaded: (userId) => {
    const state = get();
    if (state.userId === userId && (state.groups !== undefined || state.inflight)) return;
    // Reached only when there's nothing usable cached for this userId yet
    // (either it's a different user than last time, or the same user with
    // no groups loaded and no fetch already in flight) — groups is always
    // undefined at this point either way.
    const inflight = fetchMyGroups(userId)
      .then((groups) => {
        set({ userId, groups, inflight: null });
        return groups;
      })
      .catch(() => {
        // Matches every pre-existing call site's own .catch(() => setGroups([]))
        // — none of them had error UI for this particular read.
        set({ userId, groups: [], inflight: null });
        return [];
      });
    set({ userId, groups: undefined, inflight });
  },

  invalidate: () => set({ groups: undefined, inflight: null }),
}));

// Read-only hook: returns cached groups (undefined while loading), fetching
// once per userId and automatically re-fetching if invalidateMyGroups() is
// called while mounted (e.g. after this user creates/joins/leaves a group).
export function useMyGroups(userId: string | null): GroupMembership[] | undefined {
  const groups = useGroupsCacheStore((state) => (state.userId === userId ? state.groups : undefined));
  const inflight = useGroupsCacheStore((state) => (state.userId === userId ? state.inflight : null));

  useEffect(() => {
    if (userId && groups === undefined && !inflight) {
      useGroupsCacheStore.getState().ensureLoaded(userId);
    }
  }, [userId, groups, inflight]);

  return groups;
}

// Called by api.ts's mutations (createGroup, updateGroup, deleteGroup,
// acceptGroupInvite) so every mounted useMyGroups reader picks up the
// change on its own, without each mutation's caller remembering to.
export function invalidateMyGroups(): void {
  useGroupsCacheStore.getState().invalidate();
}
