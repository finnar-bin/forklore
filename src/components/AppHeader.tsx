import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LogoutIcon from '@mui/icons-material/Logout';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../theme/theme';
import { signOut } from '../features/auth/api';

// Sticky top bar for feature screens. Includes theme toggle + logout inline
// rather than behind a profile avatar (design-system.md's documented
// pattern) — Ticket 17's Profile screen doesn't exist yet, so there is
// nowhere else to put logout. See docs/pending-deviations.md (Ticket 6).
export function AppHeader({ title }: { title: string }) {
  const { mode, systemMode, setMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await signOut();
  }

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{ bgcolor: 'background.paper', boxShadow: tokens.sh1 }}
    >
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 500 }}>
          {title}
        </Typography>
        <IconButton
          aria-label="Toggle theme"
          onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}
        >
          {resolvedMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
        <IconButton aria-label="Log out" onClick={handleLogout} disabled={loggingOut}>
          <LogoutIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
