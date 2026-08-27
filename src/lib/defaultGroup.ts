import type { GroupMembership } from "../types/group";

// Picks which group a groupAware screen should land in when the current
// route doesn't already carry a :groupId (the "/" redirect, BottomNav
// tapped from Progress/Profile). Only ever returns the group the user last
// explicitly picked — a GroupCard tap on /groups, the only way to switch
// groups now (see activeGroupStorage.ts) — deliberately does **not** guess
// a "first" group when nothing's stored or the stored one is stale (no
// longer a member), so a user with no established context (first login,
// right after onboarding, or after leaving their last-picked group) lands
// on `/groups` to explicitly choose instead of being silently dropped into
// whichever group happens to sort first. Every account is guaranteed at
// least one group now (see docs/pending-deviations.md, "Remove personal
// mode"), so `/groups` always has something to pick from once `groups` has
// loaded.
export function resolveDefaultGroupId(
  groups: GroupMembership[] | undefined,
  storedGroupId: string | null,
): string | null {
  if (!groups || !storedGroupId) return null;
  return groups.some((m) => m.group.id === storedGroupId)
    ? storedGroupId
    : null;
}
