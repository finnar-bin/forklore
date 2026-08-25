import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import LogoutIcon from '@mui/icons-material/Logout';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { useAppStore } from '../../store/useAppStore';
import { LogoutConfirmDialog } from '../../components/LogoutConfirmDialog';
import { attemptLogout, performLogout } from '../auth/api';
import { updateMyProfile, type ProfileInput } from './api';
import { useMyProfile, useMyProfileLoadError, invalidateMyProfile } from './useMyProfile';
import { ProfileForm } from './ProfileForm';

const REPO_URL = 'https://github.com/finnar-bin/forklore';

// Account-level info (name/avatar/height/birthdate) plus logout and the
// theme toggle — see design-system.md's "Profile/account access" pattern and
// frontend-architecture.md's "Logout behavior". Weight/goal editing is
// explicitly out of scope, owned by Progress (Ticket 18).
export function Profile() {
  const userId = useAppStore((state) => state.userId);
  const { mode, systemMode, setMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const profile = useMyProfile(userId);
  const loadError = useMyProfileLoadError(userId);

  const [justSaved, setJustSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  async function handleSave(input: ProfileInput) {
    // Unreachable in practice — the form below can't render until `profile`
    // has loaded, which requires a non-null userId — but guarded rather than
    // asserted non-null, matching IngredientDetail's/RecipeDetail's own
    // handleSubmit guards for the same shape of invariant.
    if (!userId) return;
    await updateMyProfile(userId, input);
    setJustSaved(true);
  }

  // Same two-step flow as AppHeader's prior inline logout button (see
  // frontend-architecture.md "Logout behavior") — check the outbox first,
  // only show the confirm dialog when there's something pending to lose.
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

  if (loadError) {
    return (
      <Box sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => invalidateMyProfile()}>
              Try again
            </Button>
          }
        >
          Couldn't load your profile.
        </Alert>
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, mx: 'auto', pb: 8 }}>
      <Paper sx={{ p: 3, borderRadius: '14px', boxShadow: tokens.sh2 }}>
        <ProfileForm
          initialValues={{
            name: profile.name,
            avatar_url: profile.avatar_url,
            height_cm: profile.height_cm,
            birthdate: profile.birthdate,
          }}
          submitLabel="Save changes"
          onSubmit={handleSave}
        />
      </Paper>

      <Paper
        sx={{
          p: 2,
          borderRadius: '14px',
          boxShadow: tokens.sh2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography fontSize={14}>Dark mode</Typography>
        <Switch
          checked={resolvedMode === 'dark'}
          onChange={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}
          inputProps={{ 'aria-label': 'Toggle dark mode' }}
        />
      </Paper>

      <Button
        color="error"
        variant="outlined"
        size="large"
        startIcon={<LogoutIcon />}
        onClick={handleLogout}
        disabled={loggingOut}
      >
        Log out
      </Button>

      <LogoutConfirmDialog
        open={confirmOpen}
        pendingCount={pendingCount}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await performLogout();
          setConfirmOpen(false);
        }}
      />

      <Snackbar
        open={justSaved}
        autoHideDuration={3000}
        onClose={() => setJustSaved(false)}
        message="Profile saved"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          py: 1,
          textAlign: 'center',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          <Link href={REPO_URL} target="_blank" rel="noopener noreferrer" color="inherit">
            v{__APP_VERSION__} · {__GIT_HASH__}
          </Link>
        </Typography>
      </Box>
    </Stack>
  );
}
