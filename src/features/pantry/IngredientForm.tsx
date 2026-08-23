import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { PhotoUpload } from '../../components/PhotoUpload';
import type { IngredientUnit } from '../../types/ingredient';
import { INGREDIENT_UNITS } from './ingredientUnits';
import type { IngredientInput } from './api';

interface IngredientFormProps {
  initialValues?: IngredientInput;
  submitLabel: string;
  onSubmit: (input: IngredientInput) => Promise<void>;
}

export function IngredientForm({ initialValues, submitLabel, onSubmit }: IngredientFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [quantity, setQuantity] = useState(initialValues?.quantity.toString() ?? '');
  const [unit, setUnit] = useState<IngredientUnit | ''>(initialValues?.unit ?? '');
  const [kcal, setKcal] = useState(initialValues?.kcal.toString() ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialValues?.photo_url ?? null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!unit) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        quantity: Number(quantity),
        unit,
        kcal: Number(kcal),
        photo_url: photoUrl,
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
          label="Quantity"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          fullWidth
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
        <TextField
          label="Unit"
          select
          value={unit}
          onChange={(e) => setUnit(e.target.value as IngredientUnit)}
          required
          fullWidth
        >
          {INGREDIENT_UNITS.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <TextField
        label="Kcal"
        type="number"
        value={kcal}
        onChange={(e) => setKcal(e.target.value)}
        required
        fullWidth
        slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
      />
      <PhotoUpload
        photoUrl={photoUrl}
        onChange={setPhotoUrl}
        onUploadingChange={setPhotoUploading}
        entity="ingredient"
        alt={name || 'ingredient'}
      />

      <Button type="submit" variant="contained" size="large" disabled={submitting || photoUploading}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </Stack>
  );
}
