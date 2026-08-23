import { useState, type FormEvent } from 'react';
import dayjs from 'dayjs';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { ProfileInput } from './api';

// Bundles `profiles` fields (name/avatar/height/birthdate) with `weight_kg`
// even though the latter isn't a profiles column — it's the one thing the
// caller (Profile.tsx) needs from this single "Save changes" submit to also
// write a weight_logs entry. Kept out of ProfileInput itself (api.ts's
// updateMyProfile passes that type straight into a Supabase `.update()`,
// which would error on an unknown column).
export interface ProfileFormValues extends ProfileInput {
  weight_kg: number | null;
}

// Name/avatar/height/birthdate/weight — weight and birthdate directly feed
// the onboarding calorie-target calculation (Mifflin-St Jeor needs age and
// weight), but editing them here does not recompute `daily_kcal_target`;
// that recalculation is Progress's (Ticket 18) to own, not implied by "make
// this editable." See docs/pending-deviations.md (Ticket 17).
export function ProfileForm({
  initialValues,
  submitLabel,
  onSubmit,
}: {
  initialValues: ProfileFormValues;
  submitLabel: string;
  onSubmit: (input: ProfileFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(initialValues.name);
  const [avatarUrl, setAvatarUrl] = useState(initialValues.avatar_url ?? '');
  const [height, setHeight] = useState(initialValues.height_cm?.toString() ?? '');
  const [birthdate, setBirthdate] = useState(initialValues.birthdate ?? '');
  const [weight, setWeight] = useState(initialValues.weight_kg?.toString() ?? '');
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
        birthdate: birthdate.trim() === '' ? null : birthdate,
        // Left blank means "no new measurement today" — unlike the other
        // fields, this isn't a single value to overwrite, so there's no
        // equivalent of clearing it back to null.
        weight_kg: weight.trim() === '' ? null : Number(weight),
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
        fullWidth
        slotProps={{ htmlInput: { min: 50, max: 300, step: 0.1 } }}
      />
      <TextField
        label="Weight today (kg, optional)"
        type="number"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        fullWidth
        helperText="Leave blank to skip logging a new weight."
        slotProps={{ htmlInput: { min: 20, max: 400, step: 0.1 } }}
      />

      <Button type="submit" variant="contained" size="large" disabled={submitting || name.trim() === ''}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </Stack>
  );
}
