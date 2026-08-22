import Box from '@mui/material/Box';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { GroupSettings } from '../features/groups/GroupSettings';

export function GroupSettingsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  if (!groupId) return null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Group settings" onBack={() => navigate(`/groups/${groupId}/pantry`)} />
      <GroupSettings groupId={groupId} />
    </Box>
  );
}
