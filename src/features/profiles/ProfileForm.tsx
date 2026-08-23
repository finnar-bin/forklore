import { useState, type FormEvent } from 'react';
import dayjs from 'dayjs';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { ProfileInput } from './api';

// Name/avatar/height/birthdate only, per Ticket 17's scope — weight/goal
// fields live on Progress (Ticket 18), not here. Birthdate directly feeds
// the onboarding calorie-target calculation (Mifflin-St Jeor needs age),
// but editing it here does not recompute `daily_kcal_target`; that
// recalculation is Progress's to own, not implied by "make this editable."
// See docs/pending-deviations.md (Ticket 17).
//
// Height is required, not nullable from this screen — same `required` +
// `min`/`max`/`step` bounds as onboarding's BodyMetricsStep, which already
// treats it as a mandatory field for the identical column. `min={50}` rules
// out 0 and negative values (and anything else outside a plausible human
// height) well before either bound alone would.
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
  const [birthdate, setBirthdate] = useState(initialValues.birthdate ?? '');
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
        height_cm: Number(height),
        birthdate: birthdate.trim() === '' ? null : birthdate,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      // try/finally (not just the catch branch) — this form stays mounted
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
      <DatePicker
        label="Birthdate"
        value={birthdate ? dayjs(birthdate) : null}
        onChange={(newValue) => setBirthdate(newValue?.isValid() ? newValue.format('YYYY-MM-DD') : '')}
        disableFuture
        minDate={dayjs().subtract(120, 'year')}
        slotProps={{ textField: { required: true, fullWidth: true } }}
      />
      <TextField
        label="Height (cm)"
        type="number"
        value={height}
        onChange={(e) => setHeight(e.target.value)}
        required
        fullWidth
        slotProps={{ htmlInput: { min: 50, max: 300, step: 0.1 } }}
      />

      <Button type="submit" variant="contained" size="large" disabled={submitting || name.trim() === ''}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </Stack>
  );
}
