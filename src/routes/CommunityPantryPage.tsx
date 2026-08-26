import Box from '@mui/material/Box';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { CommunityPantryList } from '../features/community/CommunityPantryList';

// Reached from a button on /pantry or /groups/:id/pantry (see
// docs/pending-deviations.md, "Community pantry"), not a bottom tab — falls
// back to /pantry, same fixed-path convention SyncStatusPage/ProfilePage/
// GroupsPage already use for a screen reachable from more than one place.
export function CommunityPantryPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Community pantry" onBack={() => navigate('/pantry')} />
      <CommunityPantryList />
    </Box>
  );
}
