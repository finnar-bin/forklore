import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

// Unlike DeleteIngredientDialog, there's no downstream usage to warn about —
// a log entry isn't referenced by anything else — so this is a plain confirm.
export function DeleteLogEntryDialog({
  open,
  entryName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  entryName: string;
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
          : "Failed to delete this entry. Try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Delete this entry?</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText>
          Remove "{entryName}" from your log? This can't be undone.
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
          {deleting ? "Deleting…" : "Delete entry"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
