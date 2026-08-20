import Box from '@mui/material/Box';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { RecipeDetail } from '../features/recipes/RecipeDetail';

export function RecipeDetailPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Recipe" onBack={() => navigate('/recipes')} />
      <RecipeDetail />
    </Box>
  );
}
