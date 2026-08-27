import type { GroupMembership } from "../types/group";

// Picks which group a groupAware screen should land in when the current
// route doesn't already carry a :groupId (the "/" redirect, BottomNav
// tapped from Progress/Profile/a bare cross-context log view) — every
// account is guaranteed at least one group now (see
// docs/pending-deviations.md, "Remove personal mode"), so there's always a
// real answer once `groups` has loaded. Prefers the last group explicitly
// picked via ContextSwitcher (see activeGroupStorage.ts), falling back to
// the first membership if that's stale (no longer a member) or nothing was
// ever stored. Returns null only while `groups` hasn't loaded yet, or for
// the small window before onboarding's group step where an account
// genuinely has none.
export function resolveDefaultGroupId(
  groups: GroupMembership[] | undefined,
  storedGroupId: string | null,
): string | null {
  if (!groups || groups.length === 0) return null;
  if (storedGroupId && groups.some((m) => m.group.id === storedGroupId)) {
    return storedGroupId;
  }
  return groups[0].group.id;
}
