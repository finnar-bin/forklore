import Box from '@mui/material/Box';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { IngredientDetail } from '../features/pantry/IngredientDetail';

export function IngredientDetailPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Ingredient" onBack={() => navigate('/pantry')} />
      <IngredientDetail />
    </Box>
  );
}
