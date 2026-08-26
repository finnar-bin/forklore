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
import { checkCommunityIngredientUsage, checkIngredientUsage, type IngredientUsage } from './api';

export function DeleteIngredientDialog({
  open,
  ingredientName,
  ingredientId,
  isCommunity = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  ingredientName: string;
  ingredientId: string;
  // Adds a second, privileged, count-only usage check alongside the named
  // one below — check_ingredient_usage only sees recipes the caller can
  // already read, which under-reports real usage for an ingredient other
  // users' private recipes might also reference. See
  // docs/pending-deviations.md ("Community pantry").
  isCommunity?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [usage, setUsage] = useState<IngredientUsage[] | null>(null);
  const [communityUsageCount, setCommunityUsageCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Cached once fetched — the dialog is mounted for a single fixed
    // ingredient, so reopening it doesn't need to refetch.
    if (!open || usage !== null) return;
    checkIngredientUsage(ingredientId).then(setUsage).catch(() => setUsage([]));
  }, [open, ingredientId, usage]);

  useEffect(() => {
    if (!open || !isCommunity || communityUsageCount !== null) return;
    checkCommunityIngredientUsage(ingredientId)
      .then(setCommunityUsageCount)
      .catch(() => setCommunityUsageCount(null));
  }, [open, isCommunity, ingredientId, communityUsageCount]);

  // Recipes beyond the ones check_ingredient_usage could name — never
  // negative (the named list is necessarily a subset of the total).
  const unnamedUsageCount =
    isCommunity && usage !== null && communityUsageCount !== null
      ? Math.max(0, communityUsageCount - usage.length)
      : 0;

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
        {usage === null || (isCommunity && communityUsageCount === null) ? (
          <CircularProgress size={24} />
        ) : usage.length === 0 && unnamedUsageCount === 0 ? (
          <DialogContentText>
            This can't be undone. Delete this ingredient anyway?
          </DialogContentText>
        ) : (
          <>
            {usage.length > 0 && (
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
            {unnamedUsageCount > 0 && (
              <DialogContentText sx={{ mt: usage.length > 0 ? 1.5 : 0 }}>
                It's also used in {unnamedUsageCount} other recipe{unnamedUsageCount > 1 ? 's' : ''} you
                don't have access to. Deleting it will affect those too.
              </DialogContentText>
            )}
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
          disabled={usage === null || (isCommunity && communityUsageCount === null) || deleting}
        >
          {deleting ? 'Deleting…' : 'Delete ingredient'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
