import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import { AppHeader } from '../components/AppHeader';
import { ContextSwitcher } from '../components/ContextSwitcher';
import { RecipeList } from '../features/recipes/RecipeList';
import { useSyncedActiveGroupId } from '../store/useAppStore';

export function RecipesPage() {
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>();
  const groupId = useSyncedActiveGroupId(routeGroupId);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Recipes" />
      <ContextSwitcher tab="recipes" activeGroupId={groupId} />
      <RecipeList groupId={groupId} />
    </Box>
  );
}
