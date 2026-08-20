import Box from '@mui/material/Box';
import { AppHeader } from '../components/AppHeader';
import { PantryList } from '../features/pantry/PantryList';

export function PantryPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Pantry" />
      <PantryList />
    </Box>
  );
}
