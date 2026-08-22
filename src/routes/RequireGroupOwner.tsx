import { useEffect, useState } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { fetchMyGroups } from '../features/groups/api';

// Guards /groups/:groupId/settings specifically — nested inside
// RequireGroupMember, so membership is already confirmed by the time this
// runs; this only adds the "owner, not just a member" check the ticket's
// acceptance criteria call for. A non-owner member is bounced to that
// group's own pantry (they're still a valid member, just not allowed on
// this screen) rather than /groups.
//
// Fails open the same way RequireGroupMember does — RLS ("owner manages
// group" / "owner deletes group", schema.md) is the real security boundary;
// every mutation this screen can make is already owner-only enforced at the
// database level regardless of this guard. See docs/pending-deviations.md
// (Ticket 13).
export function RequireGroupOwner() {
  const { groupId } = useParams<{ groupId: string }>();
  const userId = useAppStore((state) => state.userId);
  const [state, setState] = useState<'checking' | 'owner' | 'not-owner'>('checking');

  useEffect(() => {
    if (!userId || !groupId) return;
    let cancelled = false;
    setState('checking');
    fetchMyGroups(userId)
      .then((groups) => {
        if (cancelled) return;
        const membership = groups.find((m) => m.group.id === groupId);
        setState(membership?.role === 'owner' ? 'owner' : 'not-owner');
      })
      .catch(() => {
        if (!cancelled) setState('owner');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, groupId]);

  if (state === 'checking') return null;
  if (state === 'not-owner') return <Navigate to={`/groups/${groupId}/pantry`} replace />;
  return <Outlet />;
}
