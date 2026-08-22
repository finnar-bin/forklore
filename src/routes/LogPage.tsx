import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import { AppHeader } from '../components/AppHeader';
import { ContextSwitcher } from '../components/ContextSwitcher';
import { DailyLog } from '../features/logging/DailyLog';
import { useSyncedActiveGroupId } from '../store/useAppStore';

export function LogPage() {
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>();
  const groupId = useSyncedActiveGroupId(routeGroupId);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Log" />
      <ContextSwitcher tab="log" activeGroupId={groupId} />
      <DailyLog groupId={groupId} />
    </Box>
  );
}
