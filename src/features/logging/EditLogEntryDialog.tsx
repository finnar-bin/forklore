import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { deleteLogEntry, updateLogEntry } from './api';
import { DeleteLogEntryDialog } from './DeleteLogEntryDialog';
import type { LogEntry } from '../../types/log';

// Fast-follow mentioned in Ticket 8: editing (or deleting) an already-logged
// entry's own snapshot values, independent of whatever its source
// ingredient/recipe looks like now.
export function EditLogEntryDialog({
  open,
  entry,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  entry: LogEntry;
  onClose: () => void;
  onSaved: (entry: LogEntry) => void;
  onDeleted: (entryId: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit log entry</DialogTitle>
      {/* Mounted only while open, so its draft state starts fresh (matching
          the source entry) every time it's reopened for a different entry. */}
      {open && (
        <EditLogEntryForm entry={entry} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />
      )}
    </Dialog>
  );
}

function EditLogEntryForm({
  entry,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: LogEntry;
  onClose: () => void;
  onSaved: (entry: LogEntry) => void;
  onDeleted: (entryId: string) => void;
}) {
  const [name, setName] = useState(entry.snapshot_name);
  const [kcal, setKcal] = useState(entry.snapshot_kcal.toString());
  const [quantity, setQuantity] = useState(entry.snapshot_quantity?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const parsedKcal = Number(kcal);
  const isValid = name.trim() !== '' && Number.isFinite(parsedKcal) && parsedKcal >= 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValid) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await updateLogEntry(entry.id, {
        snapshot_name: name.trim(),
        snapshot_kcal: parsedKcal,
        snapshot_quantity: quantity.trim() === '' ? null : Number(quantity),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes. Try again.');
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteLogEntry(entry.id);
    onDeleted(entry.id);
  }

  return (
    <>
      <DialogContent sx={{ pt: '12px !important' }}>
        <Stack spacing={2.5} component="form" id="edit-log-entry-form" onSubmit={handleSubmit}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoFocus
            disabled={saving}
          />
          <TextField
            label="Kcal"
            type="number"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            required
            fullWidth
            disabled={saving}
            slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
          />
          <TextField
            label="Quantity (optional)"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            fullWidth
            disabled={saving}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          justifyContent: { sm: 'space-between' },
          gap: 3,
          px: 3,
          pb: 2,
        }}
      >
        <Button
          color="error"
          variant="outlined"
          onClick={() => setDeleteOpen(true)}
          disabled={saving}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Delete log entry
        </Button>
        <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Button onClick={onClose} disabled={saving} sx={{ flex: { xs: 1, sm: 'initial' } }}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-log-entry-form"
            variant="contained"
            disabled={!isValid || saving}
            sx={{ flex: { xs: 1, sm: 'initial' } }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </Stack>
      </DialogActions>

      <DeleteLogEntryDialog
        open={deleteOpen}
        entryName={entry.snapshot_name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
