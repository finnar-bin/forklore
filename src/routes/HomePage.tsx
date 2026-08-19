import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LogoutIcon from '@mui/icons-material/Logout';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../theme/theme';
import { signOut } from '../features/auth/api';

// Temporary authenticated landing page — real routing (Pantry, Recipes, Log,
// Progress) lands in later tickets. This exists to give RequireAuth something
// real to gate.
export function HomePage() {
  const { mode, setMode } = useColorScheme();
  const tokens = mode === 'dark' ? shadows.dark : shadows.light;
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await signOut();
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{ bgcolor: 'background.paper', boxShadow: tokens.sh1 }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 500 }}>
            Forklore
          </Typography>
          <IconButton
            aria-label="Toggle theme"
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          >
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <IconButton aria-label="Log out" onClick={handleLogout} disabled={loggingOut}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Stack spacing={3} sx={{ p: 3, maxWidth: 480, mx: 'auto' }}>
        <Paper sx={{ p: 3, borderRadius: '14px', boxShadow: tokens.sh2 }}>
          <Typography variant="subtitle1" fontWeight={500} gutterBottom>
            You're logged in
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pantry, recipes, log, and progress land in later tickets — this
            screen exists to prove auth-gated routing works.
          </Typography>
        </Paper>

        <Button variant="contained" size="large" onClick={handleLogout} disabled={loggingOut}>
          Log out
        </Button>
      </Stack>
    </Box>
  );
}
