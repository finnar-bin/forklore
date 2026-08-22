import Box from '@mui/material/Box';
import { AppHeader } from '../components/AppHeader';
import { GroupList } from '../features/groups/GroupList';

export function GroupsPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Groups" />
      <GroupList />
    </Box>
  );
}
