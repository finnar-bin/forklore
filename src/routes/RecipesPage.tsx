import Box from '@mui/material/Box';
import { AppHeader } from '../components/AppHeader';
import { RecipeList } from '../features/recipes/RecipeList';

export function RecipesPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Recipes" />
      <RecipeList />
    </Box>
  );
}
