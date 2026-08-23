import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import type { ProfileInput } from './api';

// Name/avatar/height only, per Ticket 17's scope — weight/goal fields live
// on Progress (Ticket 18), not here. Same "Photo URL" text-field pattern as
// IngredientForm/GroupForm/RecipeForm (photo_url is a plain string column
// everywhere in this app; no real upload flow exists yet despite
// frontend-architecture.md describing one for ingredient/recipe photos).
export function ProfileForm({
  initialValues,
  submitLabel,
  onSubmit,
}: {
  initialValues: ProfileInput;
  submitLabel: string;
  onSubmit: (input: ProfileInput) => Promise<void>;
}) {
  const [name, setName] = useState(initialValues.name);
  const [avatarUrl, setAvatarUrl] = useState(initialValues.avatar_url ?? '');
  const [height, setHeight] = useState(initialValues.height_cm?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        avatar_url: avatarUrl.trim() === '' ? null : avatarUrl.trim(),
        height_cm: height.trim() === '' ? null : Number(height),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      // try/finally, not just the catch branch — this form stays mounted
      // after a successful save (same "Save changes" pattern as
      // GroupSettings/RecipeDetail), so `submitting` must reset on that path
      // too or the button gets stuck on "Saving…" (docs/pending-deviations.md,
      // Ticket 7).
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
        label="Photo URL (optional)"
        value={avatarUrl}
        onChange={(e) => setAvatarUrl(e.target.value)}
        fullWidth
      />
      <TextField
        label="Height (cm)"
        type="number"
        value={height}
        onChange={(e) => setHeight(e.target.value)}
        fullWidth
        slotProps={{ htmlInput: { min: 50, max: 300, step: 0.1 } }}
      />

      <Button type="submit" variant="contained" size="large" disabled={submitting || name.trim() === ''}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </Stack>
  );
}
