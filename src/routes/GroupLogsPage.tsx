import Box from '@mui/material/Box';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { GroupLogPicker } from '../features/logging/GroupLogPicker';

export function GroupLogsPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Group logs" onBack={() => navigate('/log')} />
      <GroupLogPicker />
    </Box>
  );
}
