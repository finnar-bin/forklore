import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { formatKcalPerUnit, kcalPerUnit } from '../../lib/kcal';
import type { Recipe } from '../../types/recipe';
import type { MealType } from '../../types/log';
import type { LogEntryInput } from './api';
import { MealTypeSelector } from './MealTypeSelector';

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
  groupLabel,
  onLog,
  onCancel,
}: {
  recipe: Recipe;
  // Resolved by the caller (AddLogEntryDialog's own groupLabel helper) —
  // "Personal" or the owning group's name (recipes have no community tier).
  groupLabel: string;
  onLog: (input: LogEntryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [gramsEaten, setGramsEaten] = useState('');
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedGramsEaten = Number(gramsEaten);
  // Only flagged once something's actually been typed — an empty field
  // isn't "negative" or "over the limit," it's just not filled in yet
  // (canLog below already keeps the button disabled either way).
  const isNegative = gramsEaten !== '' && parsedGramsEaten < 0;
  const exceedsWeight = gramsEaten !== '' && parsedGramsEaten > recipe.weight_g;
  const canLog = Number.isFinite(parsedGramsEaten) && parsedGramsEaten > 0 && parsedGramsEaten <= recipe.weight_g;
  const kcal = kcalPerUnit(recipe.total_kcal, recipe.weight_g) * parsedGramsEaten;

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
        // Recipes are always logged in grams — see Ticket 12's
        // servings -> weight change (docs/pending-deviations.md).
        snapshot_unit: 'g',
        meal_type: mealType,
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
          {/* Name + its own weight (subtle, beside it — same treatment as
              IngredientAutocompleteOption.tsx's ingredient row) on the
              left, with a group subtitle below; the live-computed kcal for
              the amount being typed, plus the "kcal per gram" rate below
              it, on the right — vertically centered against the whole
              left-side block, directly above the Amount field it
              reflects. */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, minWidth: 0 }}>
                <Typography fontSize={18} fontWeight={500} noWrap sx={{ minWidth: 0 }}>
                  {recipe.name}
                </Typography>
                <Typography fontSize={18} color="text.secondary" sx={{ flexShrink: 0 }}>
                  {recipe.weight_g} g
                </Typography>
              </Box>
              <Typography fontSize={13} color="text.secondary" noWrap>
                {groupLabel}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography fontSize={20} color="primary.main">
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {kcal.toFixed(2)}
                </Box>{' '}
                <Box component="span" sx={{ fontWeight: 400 }}>
                  kcal
                </Box>
              </Typography>
              <Typography fontSize={13} color="text.secondary">
                {formatKcalPerUnit(recipe.total_kcal, recipe.weight_g)} kcal per g
              </Typography>
            </Box>
          </Box>
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
          <MealTypeSelector value={mealType} onChange={setMealType} disabled={submitting} />
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
