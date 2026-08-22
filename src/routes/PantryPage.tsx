import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import { AppHeader } from '../components/AppHeader';
import { ContextSwitcher } from '../components/ContextSwitcher';
import { PantryList } from '../features/pantry/PantryList';
import { useSyncedActiveGroupId } from '../store/useAppStore';

export function PantryPage() {
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>();
  const groupId = useSyncedActiveGroupId(routeGroupId);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Pantry" />
      <ContextSwitcher tab="pantry" activeGroupId={groupId} />
      <PantryList groupId={groupId} />
    </Box>
  );
}
