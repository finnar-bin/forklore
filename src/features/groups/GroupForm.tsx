import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import type { GroupInput } from './api';

export function GroupForm({
  submitLabel,
  onSubmit,
}: {
  submitLabel: string;
  onSubmit: (input: GroupInput) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        description: description.trim() === '' ? null : description.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        fullWidth
        autoFocus
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        fullWidth
        multiline
        minRows={2}
      />

      <Button type="submit" variant="contained" size="large" disabled={submitting || name.trim() === ''}>
        {submitting ? 'Creating…' : submitLabel}
      </Button>
    </Stack>
  );
}
