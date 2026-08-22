import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { acceptGroupInvite, fetchGroupName } from './api';

type Status = 'accepting' | 'success' | 'error';

// Top-level, not nested under /groups — see routes.md's note that this route
// must work for a logged-in user clicking a link from anywhere. Only gated
// by RequireAuth (not RequireOnboarded) for the same reason — see
// docs/pending-deviations.md (Ticket 11).
export function AcceptInvite() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>('accepting');
  const [groupName, setGroupName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guards against React StrictMode's double-invoked effects in dev — the
  // invite code is single-use, so a second real attempt would fail even
  // though the first one already succeeded.
  const attempted = useRef(false);

  useEffect(() => {
    if (!inviteCode || attempted.current) return;
    attempted.current = true;

    acceptGroupInvite(inviteCode)
      .then(async (groupId) => {
        setGroupName(await fetchGroupName(groupId));
        setStatus('success');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'This invite code is invalid or has expired.');
        setStatus('error');
      });
  }, [inviteCode]);

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
          {status === 'accepting' && (
            <>
              <CircularProgress />
              <Typography color="text.secondary">Joining group…</Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <Typography variant="h6" fontWeight={500}>
                You've joined {groupName ?? 'the group'}
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
