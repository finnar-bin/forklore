import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

// Deleting a group cascades to its members, ingredients, recipes, and log
// entries (schema.md's `on delete cascade` foreign keys) — no usage check
// like DeleteIngredientDialog, since there's nothing to warn about beyond
// "everything in this group goes with it."
export function DeleteGroupDialog({
  open,
  groupName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  groupName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete this group. Try again.",
      );
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Delete {groupName}?</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText>
          This can't be undone. Every member will lose access, and this group's
          pantry, recipes, and log entries will be permanently deleted.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={handleConfirm}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : "Delete group"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
