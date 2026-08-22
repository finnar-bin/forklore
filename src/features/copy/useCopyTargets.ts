import { useEffect, useState } from 'react';
import { fetchMyGroups } from '../groups/api';

export interface CopyTarget {
  groupId: string | null;
  label: string;
}

// "Copy to..." target list for both ingredient and recipe copy: Personal
// plus every group the caller belongs to, excluding whichever context the
// item is already in — this ticket's three supported directions are
// group->group, group->personal, and personal->group, not copying into the
// exact same context. `null` while still loading (distinct from `[]`, no
// groups at all) so the dialog can show a loading state. Live Supabase read,
// same as every other fetchMyGroups call site — groups aren't mirrored into
// Dexie (see docs/pending-deviations.md, Ticket 11). See docs/pending-deviations.md
// (Ticket 14).
export function useCopyTargets(userId: string | null, sourceGroupId: string | null): CopyTarget[] | null {
  const [targets, setTargets] = useState<CopyTarget[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setTargets(null);
    fetchMyGroups(userId)
      .then((memberships) => {
        if (cancelled) return;
        const options: CopyTarget[] = [];
        if (sourceGroupId !== null) options.push({ groupId: null, label: 'Personal' });
        for (const { group } of memberships) {
          if (group.id !== sourceGroupId) options.push({ groupId: group.id, label: group.name });
        }
        setTargets(options);
      })
      .catch(() => {
        if (!cancelled) setTargets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, sourceGroupId]);

  return targets;
}
