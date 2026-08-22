import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

// Plain confirm — removing a member only deletes their group_members row
// (schema.md); it never touches ingredients/recipes/log entries they
// already contributed to that group (those keep their own created_by/
// logged_by, same as any other row).
export function RemoveMemberDialog({
  open,
  memberName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  memberName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (removing) return;
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    setError(null);
    setRemoving(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove this member. Try again.');
      setRemoving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Remove {memberName}?</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText>
          They'll lose access to this group's pantry, recipes, and log. Anything they've already
          added stays in the group.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={removing}>
          Cancel
        </Button>
        <Button color="error" variant="contained" onClick={handleConfirm} disabled={removing}>
          {removing ? 'Removing…' : 'Remove'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
