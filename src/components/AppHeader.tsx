import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SyncIcon from '@mui/icons-material/Sync';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import GroupIcon from '@mui/icons-material/Group';
import { useColorScheme } from '@mui/material/styles';
import { useLocation, useNavigate } from 'react-router-dom';
import { shadows } from '../theme/theme';
import { useAppStore } from '../store/useAppStore';
import { useSyncStore } from '../store/useSyncStore';
import { useMyProfile } from '../features/profiles/useMyProfile';
import { PhotoThumbnail } from './PhotoThumbnail';

// Sticky top bar for feature screens.
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
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;
  const navigate = useNavigate();
  const location = useLocation();
  const syncStatus = useSyncStore((state) => state.status);
  const userId = useAppStore((state) => state.userId);
  const profile = useMyProfile(userId);

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
        {/* Persistent account-access icon, per design-system.md's "Profile/
            account access" pattern — edit profile, logout, and the theme
            toggle all live behind it now (Ticket 17), replacing the inline
            theme-toggle/logout buttons this header used before that screen
            existed (docs/pending-deviations.md, Ticket 6). */}
        {location.pathname !== '/profile' && (
          <IconButton aria-label="Profile" onClick={() => navigate('/profile')} sx={{ p: 0.5 }}>
            <PhotoThumbnail photoUrl={profile?.avatar_url ?? null} alt="Your avatar" size={32} />
          </IconButton>
        )}
      </Toolbar>
    </AppBar>
  );
}
