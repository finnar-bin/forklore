import Box from '@mui/material/Box';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { RecipeDetail } from '../features/recipes/RecipeDetail';
import { useSyncedActiveGroupId } from '../store/useAppStore';

export function RecipeDetailPage() {
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>();
  const groupId = useSyncedActiveGroupId(routeGroupId);
  const navigate = useNavigate();
  const backPath = groupId ? `/groups/${groupId}/recipes` : '/recipes';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Recipe" onBack={() => navigate(backPath)} />
      <RecipeDetail groupId={groupId} backPath={backPath} />
    </Box>
  );
}
