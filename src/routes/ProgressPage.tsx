import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { AppHeader } from '../components/AppHeader';

// Placeholder only — real weight/BMI trend content is Ticket 18. This route
// exists now purely so BottomNav's four tabs all lead somewhere real instead
// of 404ing. See docs/pending-deviations.md (Ticket 16).
export function ProgressPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppHeader title="Progress" />
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8, px: 2 }}>
        <Typography color="text.secondary" textAlign="center">
          Progress tracking is coming soon.
        </Typography>
      </Box>
    </Box>
  );
}
