import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { acceptGroupInvite, previewGroupInvite } from './api';

type Status = 'loading' | 'confirm' | 'accepting' | 'success' | 'error';

const INVALID_MESSAGE = 'This invite link is invalid or has expired.';

// Top-level, not nested under /groups — see routes.md's note that this route
// must work for a logged-in user clicking a link from anywhere. Only gated
// by RequireAuth (not RequireOnboarded) for the same reason — see
// docs/pending-deviations.md (Ticket 11).
//
// Previews the invite (read-only, doesn't consume it) before asking the user
// to confirm — accept_group_invite only ever runs from an explicit button
// tap, never automatically on load. See docs/pending-deviations.md (Ticket
// 11 fix, found during review) for why this replaced the original
// auto-accept-on-load behavior: a single-use code was being burned just by
// opening the link, with no chance to see which group it was for or back out.
export function AcceptInvite() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>('loading');
  const [groupName, setGroupName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteCode) return;
    previewGroupInvite(inviteCode)
      .then((preview) => {
        if (!preview) {
          setError(INVALID_MESSAGE);
          setStatus('error');
          return;
        }
        setGroupName(preview.groupName);
        setStatus('confirm');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : INVALID_MESSAGE);
        setStatus('error');
      });
  }, [inviteCode]);

  async function handleAccept() {
    if (!inviteCode) return;
    setStatus('accepting');
    try {
      await acceptGroupInvite(inviteCode);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : INVALID_MESSAGE);
      setStatus('error');
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%', borderRadius: '14px', textAlign: 'center' }}>
        <Stack spacing={2} alignItems="center">
          {status === 'loading' && (
            <>
              <CircularProgress />
              <Typography color="text.secondary">Checking invite…</Typography>
            </>
          )}

          {status === 'confirm' && (
            <>
              <Typography variant="h6" fontWeight={500}>
                Join {groupName}?
              </Typography>
              <Typography color="text.secondary">
                You'll get full read/write access to this group's shared pantry, recipes, and log.
              </Typography>
              <Button variant="contained" size="large" fullWidth onClick={handleAccept}>
                Join group
              </Button>
              <Button size="large" fullWidth onClick={() => navigate('/groups', { replace: true })}>
                Not now
              </Button>
            </>
          )}

          {status === 'accepting' && (
            <>
              <CircularProgress />
              <Typography color="text.secondary">Joining group…</Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <Typography variant="h6" fontWeight={500}>
                You've joined {groupName}
              </Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => navigate('/groups', { replace: true })}
              >
                Go to groups
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <Alert severity="error" sx={{ width: '100%' }}>
                {error}
              </Alert>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                onClick={() => navigate('/groups', { replace: true })}
              >
                Go to groups
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
