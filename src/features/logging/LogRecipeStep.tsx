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

// Asks how many servings of this recipe were eaten, then snapshots kcal
// scaled from that — mirrors the quantity-scaling pattern already
// established for recipe_ingredients (kcal * quantity / base quantity)
// rather than always logging the recipe's full total_kcal as one entry.
// See docs/pending-deviations.md (Ticket 8) for why this was chosen over a
// literal one-tap "log the whole recipe" reading of the ticket's wording.
export function LogRecipeStep({
  recipe,
  onLog,
  onCancel,
}: {
  recipe: Recipe;
  onLog: (input: LogEntryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [servings, setServings] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedServings = Number(servings);
  const canLog = Number.isFinite(parsedServings) && parsedServings > 0;
  const kcal = recipe.servings > 0 ? (recipe.total_kcal / recipe.servings) * parsedServings : 0;

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
        snapshot_quantity: parsedServings,
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
            {recipe.name}
          </Typography>
          <TextField
            label="Servings eaten"
            type="number"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            required
            fullWidth
            autoFocus
            disabled={submitting}
            slotProps={{
              htmlInput: { min: 0, step: 0.1 },
              input: { endAdornment: <InputAdornment position="end">kcal: {kcal.toFixed(0)}</InputAdornment> },
            }}
          />
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
