import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../theme/theme';

// /privacy and /terms sit outside RequireAuth (App.tsx) — reachable by a
// logged-out visitor (e.g. a Google OAuth consent screen reviewer), so this
// can't reuse AppHeader, which assumes a signed-in user (profile avatar,
// sync status, groups). navigate(-1) rather than a fixed target since this
// is linked from multiple places (Profile, AuthLayout).
export function LegalPageLayout({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 2,
          bgcolor: 'background.paper',
          boxShadow: tokens.sh1,
        }}
      >
        <IconButton aria-label="Back" onClick={() => navigate(-1)} edge="start">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={500}>
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          maxWidth: 720,
          mx: 'auto',
          p: 3,
          '& h2': { fontSize: 18, fontWeight: 600, mt: 4, mb: 1 },
          '& p, & li': { fontSize: 15, lineHeight: 1.6, color: 'text.secondary' },
          '& ul': { pl: 3, mb: 2 },
          '& p': { mb: 2 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
