import Box from '@mui/material/Box';
import { AppHeader } from '../components/AppHeader';
import { DailyLog } from '../features/logging/DailyLog';

export function LogPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Log" />
      <DailyLog />
    </Box>
  );
}
