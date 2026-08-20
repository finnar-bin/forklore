import Box from '@mui/material/Box';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { AllTimeLog } from '../features/logging/AllTimeLog';

export function LogsPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="All-time log" onBack={() => navigate('/log')} />
      <AllTimeLog />
    </Box>
  );
}
