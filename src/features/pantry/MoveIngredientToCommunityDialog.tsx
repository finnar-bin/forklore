import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

export function MoveIngredientToCommunityDialog({
  open,
  ingredientName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  ingredientName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (moving) return;
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    setError(null);
    setMoving(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move this ingredient. Try again.');
    } finally {
      setMoving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Move {ingredientName} to community?</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText>
          This ingredient will be moved to the community pantry, visible and usable by every user.
          This can't be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={moving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleConfirm} disabled={moving}>
          {moving ? 'Moving…' : 'Move to community'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
