import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import type { RecipeInput } from '../../types/recipe';

interface RecipeFormProps {
  initialValues?: RecipeInput;
  submitLabel: string;
  onSubmit: (input: RecipeInput) => Promise<void>;
}

export function RecipeForm({ initialValues, submitLabel, onSubmit }: RecipeFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [servings, setServings] = useState(initialValues?.servings.toString() ?? '1');
  const [photoUrl, setPhotoUrl] = useState(initialValues?.photo_url ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        servings: Number(servings),
        photo_url: photoUrl.trim() === '' ? null : photoUrl.trim(),
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
        label="Servings"
        type="number"
        value={servings}
        onChange={(e) => setServings(e.target.value)}
        required
        fullWidth
        slotProps={{ htmlInput: { min: 1, step: 1 } }}
      />
      <TextField
        label="Photo URL (optional)"
        value={photoUrl}
        onChange={(e) => setPhotoUrl(e.target.value)}
        fullWidth
      />

      <Button type="submit" variant="contained" size="large" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </Stack>
  );
}
