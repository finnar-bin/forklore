import { useMyGroups } from "../groups/useMyGroups";

export interface CopyTarget {
  groupId: string;
  label: string;
}

// "Copy to..." target list for both ingredient and recipe copy: every group
// the caller belongs to, excluding whichever group the item is already in —
// a copy target is always a real group now that personal mode is gone (see
// docs/pending-deviations.md, "Remove personal mode"). `null` while still
// loading (distinct from `[]`, no groups at all) so the dialog can show a
// loading state. Reads from the shared groups cache (see useMyGroups)
// rather than its own fetch — see docs/pending-deviations.md (Tickets 14
// and 16).
//
// `isCommunitySource` (docs/pending-deviations.md, "Community pantry"):
// a community ingredient isn't actually "in" whichever group it happened to
// be viewed from — `sourceGroupId` in that case is just the viewing
// screen's own context, not the item's, so nothing should be excluded from
// the target list on its account.
export function useCopyTargets(
  userId: string | null,
  sourceGroupId: string | null,
  isCommunitySource = false,
): CopyTarget[] | null {
  const memberships = useMyGroups(userId);
  if (memberships === undefined) return null;

  const options: CopyTarget[] = [];
  for (const { group } of memberships) {
    if (isCommunitySource || group.id !== sourceGroupId)
      options.push({ groupId: group.id, label: group.name });
  }
  return options;
}
