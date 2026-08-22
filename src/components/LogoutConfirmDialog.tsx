import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

// See frontend-architecture.md "Logout behavior" — shown only when the
// outbox has pending items at logout time, naming the actual count rather
// than a generic warning.
export function LogoutConfirmDialog({
  open,
  pendingCount,
  onClose,
  onConfirm,
}: {
  open: boolean;
  pendingCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (loggingOut) return;
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    setError(null);
    setLoggingOut(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log out. Try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Log out?</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText>
          You have {pendingCount} unsynced change{pendingCount === 1 ? '' : 's'}. Logging out now
          will discard {pendingCount === 1 ? 'it' : 'them'}.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loggingOut}>
          Cancel
        </Button>
        <Button color="error" variant="contained" onClick={handleConfirm} disabled={loggingOut}>
          {loggingOut ? 'Logging out…' : 'Log out'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
