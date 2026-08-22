import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import { AppHeader } from '../components/AppHeader';
import { DailyLog } from '../features/logging/DailyLog';
import { fetchMyGroups } from '../features/groups/api';
import { useAppStore, useSyncedActiveGroupId } from '../store/useAppStore';

// No ContextSwitcher here (unlike PantryPage/RecipesPage) — /log itself is
// cross-context now (personal and every group, mixed), and switching to one
// group's own shared log is a deliberate navigation via "View group logs"
// (see GroupLogPicker), not an ambient toggle. This page still renders
// /groups/:groupId/log — that route just shows the group's name and a way
// back instead of the switcher chip. See docs/pending-deviations.md
// (Ticket 12 follow-up, "/log shows everything").
export function LogPage() {
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>();
  const groupId = useSyncedActiveGroupId(routeGroupId);
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId || !userId) {
      setGroupName(null);
      return;
    }
    fetchMyGroups(userId)
      .then((groups) => setGroupName(groups.find((m) => m.group.id === groupId)?.group.name ?? 'Group'))
      .catch(() => setGroupName('Group'));
  }, [groupId, userId]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader
        title={groupId ? `${groupName ?? 'Group'} log` : 'Log'}
        onBack={groupId ? () => navigate('/log') : undefined}
      />
      <DailyLog groupId={groupId} />
    </Box>
  );
}
