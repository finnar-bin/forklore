import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { kcalPerUnit } from '../../lib/kcal';
import { IngredientKcalHeader } from '../pantry/IngredientKcalHeader';
import type { Ingredient } from '../../types/ingredient';
import type { MealType } from '../../types/log';
import type { LogEntryInput } from './api';
import { MealTypeSelector } from './MealTypeSelector';

// Asks how much of this ingredient was eaten, in the ingredient's own unit
// (read-only, inherited — never user-selectable, same rule as recipe
// ingredient lines), then snapshots kcal scaled proportionally.
export function LogIngredientStep({
  ingredient,
  groupLabel,
  onLog,
  onCancel,
}: {
  ingredient: Ingredient;
  // Resolved by the caller (AddLogEntryDialog's own groupLabel helper) —
  // "Personal"/the owning group's name/"Community".
  groupLabel: string;
  onLog: (input: LogEntryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState('');
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedQuantity = Number(quantity);
  // Only flagged once something's actually been typed — an empty field
  // isn't "negative," it's just not filled in yet (canLog below already
  // keeps the button disabled either way).
  const isNegative = quantity !== '' && parsedQuantity < 0;
  const canLog = Number.isFinite(parsedQuantity) && parsedQuantity > 0;
  const kcal = kcalPerUnit(ingredient.kcal, ingredient.quantity) * parsedQuantity;

  async function handleLog() {
    if (!canLog) return;
    setSubmitting(true);
    setError(null);
    try {
      await onLog({
        source_ingredient_id: ingredient.id,
        source_recipe_id: null,
        snapshot_name: ingredient.name,
        snapshot_kcal: kcal,
        snapshot_quantity: parsedQuantity,
        snapshot_unit: ingredient.unit,
        meal_type: mealType,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log this ingredient.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogContent sx={{ pt: '12px !important' }}>
        <Stack spacing={2.5}>
          <IngredientKcalHeader ingredient={ingredient} groupLabel={groupLabel} kcal={kcal} />
          <TextField
            label="Quantity eaten"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            fullWidth
            autoFocus
            disabled={submitting}
            error={isNegative}
            helperText={isNegative ? 'Enter a positive amount.' : undefined}
            slotProps={{
              htmlInput: { min: 0, step: 0.01 },
              input: { endAdornment: <InputAdornment position="end">{ingredient.unit}</InputAdornment> },
            }}
          />
          <MealTypeSelector value={mealType} onChange={setMealType} disabled={submitting} />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleLog} disabled={!canLog || submitting}>
          {submitting ? 'Logging…' : 'Log this ingredient'}
        </Button>
      </DialogActions>
    </>
  );
}
