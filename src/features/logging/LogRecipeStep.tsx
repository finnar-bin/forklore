import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { Recipe } from '../../types/recipe';
import type { LogEntryInput } from './api';
import { formatRecipeLabel } from './formatItemLabel';

// Asks how many grams of this recipe were eaten, then snapshots kcal scaled
// from that — mirrors the quantity-scaling pattern already established for
// recipe_ingredients (kcal * quantity / base quantity) rather than always
// logging the recipe's full total_kcal as one entry. See
// docs/pending-deviations.md (Ticket 8) for why this was chosen over a
// literal one-tap "log the whole recipe" reading of the ticket's wording,
// and (Ticket 12 follow-up, "servings -> weight") for why this asks for
// grams eaten rather than servings eaten.
export function LogRecipeStep({
  recipe,
  onLog,
  onCancel,
}: {
  recipe: Recipe;
  onLog: (input: LogEntryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [gramsEaten, setGramsEaten] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedGramsEaten = Number(gramsEaten);
  // Only flagged once something's actually been typed — an empty field
  // isn't "negative" or "over the limit," it's just not filled in yet
  // (canLog below already keeps the button disabled either way).
  const isNegative = gramsEaten !== '' && parsedGramsEaten < 0;
  const exceedsWeight = gramsEaten !== '' && parsedGramsEaten > recipe.weight_g;
  const canLog = Number.isFinite(parsedGramsEaten) && parsedGramsEaten > 0 && parsedGramsEaten <= recipe.weight_g;
  const kcal = recipe.weight_g > 0 ? (recipe.total_kcal / recipe.weight_g) * parsedGramsEaten : 0;

  async function handleLog() {
    if (!canLog) return;
    setSubmitting(true);
    setError(null);
    try {
      await onLog({
        source_ingredient_id: null,
        source_recipe_id: recipe.id,
        snapshot_name: recipe.name,
        snapshot_kcal: kcal,
        snapshot_quantity: parsedGramsEaten,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log this recipe.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogContent sx={{ pt: '12px !important' }}>
        <Stack spacing={2.5}>
          <Typography color="text.secondary" fontSize={14}>
            {formatRecipeLabel(recipe)}
          </Typography>
          <TextField
            label="Amount eaten"
            type="number"
            value={gramsEaten}
            onChange={(e) => setGramsEaten(e.target.value)}
            required
            fullWidth
            autoFocus
            disabled={submitting}
            error={isNegative || exceedsWeight}
            helperText={
              isNegative
                ? 'Enter a positive amount.'
                : exceedsWeight
                  ? `Can't exceed this recipe's total weight (${recipe.weight_g}g).`
                  : undefined
            }
            slotProps={{
              htmlInput: { min: 0, max: recipe.weight_g, step: 1 },
              input: { endAdornment: <InputAdornment position="end">g</InputAdornment> },
            }}
          />
          <Typography fontSize={12} color="text.secondary">
            {kcal.toFixed(0)} kcal
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleLog} disabled={!canLog || submitting}>
          {submitting ? 'Logging…' : 'Log this recipe'}
        </Button>
      </DialogActions>
    </>
  );
}
