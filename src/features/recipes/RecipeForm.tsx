import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import type { RecipeInput, WeightUnit } from '../../types/recipe';

interface RecipeFormProps {
  initialValues?: RecipeInput;
  submitLabel: string;
  onSubmit: (input: RecipeInput) => Promise<void>;
}

export function RecipeForm({ initialValues, submitLabel, onSubmit }: RecipeFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  // weight_g is always stored in grams — the unit picker here is entry
  // convenience only, converted to grams on submit. Editing an existing
  // recipe always shows its stored gram value with "g" selected (no unit
  // choice is persisted) — see docs/pending-deviations.md (Ticket 12
  // follow-up, "servings -> weight").
  const [weight, setWeight] = useState(initialValues ? initialValues.weight_g.toString() : '');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('g');
  const [photoUrl, setPhotoUrl] = useState(initialValues?.photo_url ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const parsedWeight = Number(weight);
      const weight_g = weightUnit === 'kg' ? parsedWeight * 1000 : parsedWeight;
      await onSubmit({
        name,
        weight_g,
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
      <Stack direction="row" spacing={2}>
        <TextField
          label="Weight"
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          required
          fullWidth
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
        <TextField
          label="Unit"
          select
          value={weightUnit}
          onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
          required
          fullWidth
        >
          <MenuItem value="g">g</MenuItem>
          <MenuItem value="kg">kg</MenuItem>
        </TextField>
      </Stack>
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
