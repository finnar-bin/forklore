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
import GroupIcon from '@mui/icons-material/Group';
import { useColorScheme } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import { shadows } from '../theme/theme';
import { attemptLogout, performLogout } from '../features/auth/api';
import { useSyncStore } from '../store/useSyncStore';
import { LogoutConfirmDialog } from './LogoutConfirmDialog';

// Sticky top bar for feature screens. Includes theme toggle + logout inline
// rather than behind a profile avatar (design-system.md's documented
// pattern) — Ticket 17's Profile screen doesn't exist yet, so there is
// nowhere else to put logout. See docs/pending-deviations.md (Ticket 6).
//
// Also doubles as the app's only entry point to /sync-status: a small icon
// appears only when there's something to say (syncing/error), tapping it
// navigates there — see docs/pending-deviations.md (Ticket 9).
//
// Also the app's only entry point to /groups (not a bottom tab per
// routes.md/design-system.md, and no nav bar exists yet regardless — Ticket
// 16). Same "would otherwise be unreachable except by typing the URL"
// reasoning as /sync-status above — see docs/pending-deviations.md (Ticket 11).
export function AppHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const { mode, systemMode, setMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const syncStatus = useSyncStore((state) => state.status);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const result = await attemptLogout();
      if (result.needsConfirmation) {
        setPendingCount(result.pendingCount);
        setConfirmOpen(true);
      }
    } finally {
      setLoggingOut(false);
    }
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
        {location.pathname !== '/groups' && (
          <IconButton aria-label="Groups" onClick={() => navigate('/groups')}>
            <GroupIcon />
          </IconButton>
        )}
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
      <LogoutConfirmDialog
        open={confirmOpen}
        pendingCount={pendingCount}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await performLogout();
          setConfirmOpen(false);
        }}
      />
    </AppBar>
  );
}
