import { useEffect } from "react";
import { create } from "zustand";
import { fetchGroupMembers } from "./api";
import type { GroupMember } from "../../types/group";

interface CacheState {
  groupId: string | null;
  members: GroupMember[] | undefined;
  inflight: Promise<GroupMember[]> | null;
}

interface CacheActions {
  ensureLoaded: (groupId: string) => void;
  invalidate: () => void;
}

// Shared cache for "members of this one group", same shape and reasoning as
// useMyGroups.ts — /groups/:groupId/log is LogPage, a BottomNav tab-root
// route that fully remounts on every navigation, so without this its own
// group_members fetch would refire on every single tab switch, the exact
// bug useMyGroups was added to fix (see that file's own history). Single-
// slot (one groupId at a time), matching useMyGroups' own shape — nothing in
// this app shows two different groups' member lists at once.
const useGroupMembersCacheStore = create<CacheState & CacheActions>(
  (set, get) => ({
    groupId: null,
    members: undefined,
    inflight: null,

    ensureLoaded: (groupId) => {
      const state = get();
      if (
        state.groupId === groupId &&
        (state.members !== undefined || state.inflight)
      )
        return;
      const inflight = fetchGroupMembers(groupId)
        .then((members) => {
          set({ groupId, members, inflight: null });
          return members;
        })
        .catch(() => {
          // Matches fetchGroupMembers' existing call sites' own
          // .catch(() => setMembers(...))-style fallback — no error UI for
          // this particular read.
          set({ groupId, members: [], inflight: null });
          return [];
        });
      set({ groupId, members: undefined, inflight });
    },

    invalidate: () => set({ members: undefined, inflight: null }),
  }),
);

// Read-only hook: returns cached members (undefined while loading), fetching
// once per groupId and automatically re-fetching if invalidateGroupMembers()
// is called while mounted (e.g. after removeGroupMember).
export function useGroupMembers(
  groupId: string | null,
): GroupMember[] | undefined {
  const members = useGroupMembersCacheStore((state) =>
    state.groupId === groupId ? state.members : undefined,
  );
  const inflight = useGroupMembersCacheStore((state) =>
    state.groupId === groupId ? state.inflight : null,
  );

  useEffect(() => {
    if (groupId && members === undefined && !inflight) {
      useGroupMembersCacheStore.getState().ensureLoaded(groupId);
    }
  }, [groupId, members, inflight]);

  return members;
}

// Called after removeGroupMember (see api.ts) so every mounted
// useGroupMembers reader picks up the change on its own.
export function invalidateGroupMembers(): void {
  useGroupMembersCacheStore.getState().invalidate();
}
