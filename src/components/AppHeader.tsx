import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LogoutIcon from '@mui/icons-material/Logout';
import SyncIcon from '@mui/icons-material/Sync';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import { useColorScheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { shadows } from '../theme/theme';
import { signOut } from '../features/auth/api';
import { useSyncStore } from '../store/useSyncStore';

// Sticky top bar for feature screens. Includes theme toggle + logout inline
// rather than behind a profile avatar (design-system.md's documented
// pattern) — Ticket 17's Profile screen doesn't exist yet, so there is
// nowhere else to put logout. See docs/pending-deviations.md (Ticket 6).
//
// Also doubles as the app's only entry point to /sync-status: a small icon
// appears only when there's something to say (syncing/error), tapping it
// navigates there — see docs/pending-deviations.md (Ticket 9).
export function AppHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const { mode, systemMode, setMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const syncStatus = useSyncStore((state) => state.status);

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
        {onBack && (
          <IconButton aria-label="Back" onClick={onBack} sx={{ mr: 1 }} edge="start">
            <ArrowBackIcon />
          </IconButton>
        )}
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 500 }}>
          {title}
        </Typography>
        {syncStatus !== 'idle' && (
          <IconButton
            aria-label={syncStatus === 'error' ? 'Sync issue — view details' : 'Syncing'}
            onClick={() => navigate('/sync-status')}
            color={syncStatus === 'error' ? 'error' : 'default'}
          >
            {syncStatus === 'error' ? (
              <SyncProblemIcon />
            ) : (
              <SyncIcon
                sx={{
                  animation: 'app-header-sync-spin 1.5s linear infinite',
                  '@keyframes app-header-sync-spin': {
                    from: { transform: 'rotate(0deg)' },
                    to: { transform: 'rotate(360deg)' },
                  },
                }}
              />
            )}
          </IconButton>
        )}
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
