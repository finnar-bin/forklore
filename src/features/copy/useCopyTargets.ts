import { useMyGroups } from '../groups/useMyGroups';

export interface CopyTarget {
  groupId: string | null;
  label: string;
}

// "Copy to..." target list for both ingredient and recipe copy: Personal
// plus every group the caller belongs to, excluding whichever context the
// item is already in — this ticket's three supported directions are
// group->group, group->personal, and personal->group, not copying into the
// exact same context. `null` while still loading (distinct from `[]`, no
// groups at all) so the dialog can show a loading state. Reads from the
// shared groups cache (see useMyGroups) rather than its own fetch — see
// docs/pending-deviations.md (Tickets 14 and 16).
export function useCopyTargets(userId: string | null, sourceGroupId: string | null): CopyTarget[] | null {
  const memberships = useMyGroups(userId);
  if (memberships === undefined) return null;

  const options: CopyTarget[] = [];
  if (sourceGroupId !== null) options.push({ groupId: null, label: 'Personal' });
  for (const { group } of memberships) {
    if (group.id !== sourceGroupId) options.push({ groupId: group.id, label: group.name });
  }
  return options;
}
