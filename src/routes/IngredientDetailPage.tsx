import Box from '@mui/material/Box';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { IngredientDetail } from '../features/pantry/IngredientDetail';
import { useSyncedActiveGroupId } from '../store/useAppStore';

export function IngredientDetailPage() {
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>();
  const groupId = useSyncedActiveGroupId(routeGroupId);
  const navigate = useNavigate();
  const backPath = groupId ? `/groups/${groupId}/pantry` : '/pantry';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Ingredient" onBack={() => navigate(backPath)} />
      <IngredientDetail backPath={backPath} />
    </Box>
  );
}
