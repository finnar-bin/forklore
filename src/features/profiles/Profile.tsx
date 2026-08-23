import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import LogoutIcon from '@mui/icons-material/Logout';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { useAppStore } from '../../store/useAppStore';
import { PhotoThumbnail } from '../../components/PhotoThumbnail';
import { LogoutConfirmDialog } from '../../components/LogoutConfirmDialog';
import { attemptLogout, performLogout } from '../auth/api';
import { todayLocalDate } from '../logging/api';
import { fetchLatestWeightLog, saveTodayWeightLog, updateMyProfile } from './api';
import { useMyProfile, useMyProfileLoadError, invalidateMyProfile } from './useMyProfile';
import { ProfileForm, type ProfileFormValues } from './ProfileForm';
import type { WeightLog } from '../../types/weightLog';

// Account-level info (name/avatar/height/birthdate) plus logout and the
// theme toggle — see design-system.md's "Profile/account access" pattern and
// frontend-architecture.md's "Logout behavior". Also lets today's weight be
// logged from here directly (requested directly — see
// docs/pending-deviations.md, Ticket 17), even though the full weight
// history/trend view stays Progress's (Ticket 18) to own. Goal
// weight/type/pace editing is still out of scope here.
export function Profile() {
  const userId = useAppStore((state) => state.userId);
  const { mode, systemMode, setMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const profile = useMyProfile(userId);
  const loadError = useMyProfileLoadError(userId);

  // Not part of useMyProfile's cache — weight_logs is a separate table, and
  // (unlike the profile row) nothing else in the app reads "my latest
  // weight" yet, so a one-off fetch here doesn't risk the repeated-fetch
  // problem that cache exists to avoid. `undefined` = still loading, `null`
  // = loaded, no entry yet.
  const [weightLog, setWeightLog] = useState<WeightLog | null | undefined>(undefined);
  // Distinct from the profile's loadError — this is deliberately not a
  // full-screen error state. Weight is a supplementary, optional field on
  // this form, not a load-bearing dependency of the rest of the screen the
  // way `profile` is, so a fetch failure here shows a small inline warning
  // rather than blocking the whole form (unlike the silent
  // `.catch(() => setWeightLog(null))` this replaced, which looked
  // identical to "no weight ever logged").
  const [weightLoadError, setWeightLoadError] = useState(false);

  const loadWeightLog = useCallback(() => {
    if (!userId) return;
    setWeightLoadError(false);
    fetchLatestWeightLog(userId)
      .then((log) => setWeightLog(log ?? null))
      .catch(() => {
        // Still resolves the loading state (to "no known weight") rather
        // than leaving `weightLog` undefined forever — the render guard
        // below waits on it, and this failure is supplementary, not fatal;
        // `weightLoadError` is what actually surfaces it, via the inline
        // warning + retry below.
        setWeightLog(null);
        setWeightLoadError(true);
      });
  }, [userId]);

  useEffect(() => {
    loadWeightLog();
  }, [loadWeightLog]);

  const [justSaved, setJustSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  async function handleSave(input: ProfileFormValues) {
    // Unreachable in practice — the form below can't render until `profile`
    // has loaded, which requires a non-null userId — but guarded rather than
    // asserted non-null, matching IngredientDetail's/RecipeDetail's own
    // handleSubmit guards for the same shape of invariant.
    if (!userId) return;
    const { weight_kg, ...profileInput } = input;
    // Weight first, profile fields last — updateMyProfile invalidates the
    // shared profile cache on success, which makes `profile` briefly
    // `undefined` again while it re-fetches, and this component swaps the
    // mounted <ProfileForm> for a spinner whenever that's true (see the
    // render guard below). Awaiting anything else after that invalidation
    // would run while the form is unmounted, so any later failure has
    // nowhere to be shown — ordering it last means nothing is still
    // in flight once that swap can happen.
    if (weight_kg != null) {
      const log = await saveTodayWeightLog(userId, weight_kg);
      setWeightLog(log);
    }
    await updateMyProfile(userId, profileInput);
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

  if (!profile || weightLog === undefined) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, mx: 'auto', pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
        <PhotoThumbnail photoUrl={profile.avatar_url} alt="Your avatar" size={88} />
      </Box>

      {weightLoadError && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={loadWeightLog}>
              Try again
            </Button>
          }
        >
          Couldn't load your latest weight. You can still log today's below.
        </Alert>
      )}

      <Paper sx={{ p: 3, borderRadius: '14px', boxShadow: tokens.sh2 }}>
        <ProfileForm
          initialValues={{
            name: profile.name,
            avatar_url: profile.avatar_url,
            height_cm: profile.height_cm,
            birthdate: profile.birthdate,
            // Only prefills from an entry actually logged today — the
            // latest entry overall could be days old, and the field's
            // "blank = skip logging" contract (ProfileForm) depends on a
            // non-blank value unambiguously meaning "the user's own new
            // entry," not a stale number left over from days ago that
            // Save would otherwise silently re-date to today.
            weight_kg: weightLog?.logged_at === todayLocalDate() ? weightLog.weight_kg : null,
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
    </Stack>
  );
}
