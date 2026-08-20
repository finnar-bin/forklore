import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { checkIngredientUsage, type IngredientUsage } from './api';

export function DeleteIngredientDialog({
  open,
  ingredientName,
  ingredientId,
  onClose,
  onConfirm,
}: {
  open: boolean;
  ingredientName: string;
  ingredientId: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [usage, setUsage] = useState<IngredientUsage[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Cached once fetched — the dialog is mounted for a single fixed
    // ingredient, so reopening it doesn't need to refetch.
    if (!open || usage !== null) return;
    checkIngredientUsage(ingredientId).then(setUsage).catch(() => setUsage([]));
  }, [open, ingredientId, usage]);

  function handleClose() {
    if (deleting) return;
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    setError(null);
    setDeleting(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete this ingredient. Try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Delete {ingredientName}?</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {usage === null ? (
          <CircularProgress size={24} />
        ) : usage.length === 0 ? (
          <DialogContentText>
            This can't be undone. Delete this ingredient anyway?
          </DialogContentText>
        ) : (
          <>
            <DialogContentText>
              This ingredient is used in {usage.length} recipe{usage.length > 1 ? 's' : ''}. It
              will also be removed from these:
            </DialogContentText>
            <List dense>
              {usage.map((u) => (
                <ListItem key={u.recipe_id} disableGutters>
                  <ListItemText primary={u.recipe_name} />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={handleConfirm}
          disabled={usage === null || deleting}
        >
          {deleting ? 'Deleting…' : 'Delete ingredient'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
