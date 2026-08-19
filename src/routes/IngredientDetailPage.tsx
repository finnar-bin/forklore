import Box from '@mui/material/Box';
import { AppHeader } from '../components/AppHeader';
import { IngredientDetail } from '../features/pantry/IngredientDetail';

export function IngredientDetailPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Ingredient" />
      <IngredientDetail />
    </Box>
  );
}
