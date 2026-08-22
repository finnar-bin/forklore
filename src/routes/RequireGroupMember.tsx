import { useEffect, useState } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { fetchMyGroups } from '../features/groups/api';

// Guards /groups/:groupId/* routes — previously any authenticated,
// onboarded user could navigate to any groupId in the URL and the page
// would render whatever happened to be cached in Dexie for that group_id,
// with no membership check at all. fetchMyGroups is a live, server-
// authoritative Supabase query (not Dexie), so this redirects away from a
// stale bookmark or an old invite link to a group the caller has left.
//
// Fails open (renders the route) if the membership check itself errors —
// e.g. offline. RLS is the real security boundary here; this guard only
// exists to redirect away from a URL the caller shouldn't be looking at, not
// to enforce access control without a network connection.
export function RequireGroupMember() {
  const { groupId } = useParams<{ groupId: string }>();
  const userId = useAppStore((state) => state.userId);
  const [state, setState] = useState<'checking' | 'member' | 'not-member'>('checking');

  useEffect(() => {
    if (!userId || !groupId) return;
    let cancelled = false;
    setState('checking');
    fetchMyGroups(userId)
      .then((groups) => {
        if (cancelled) return;
        setState(groups.some((membership) => membership.group.id === groupId) ? 'member' : 'not-member');
      })
      .catch(() => {
        if (!cancelled) setState('member');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, groupId]);

  if (state === 'checking') return null;
  if (state === 'not-member') return <Navigate to="/groups" replace />;
  return <Outlet />;
}
