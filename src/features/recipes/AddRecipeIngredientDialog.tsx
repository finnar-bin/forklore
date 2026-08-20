import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useAppStore } from '../../store/useAppStore';
import { fetchIngredients } from '../pantry/api';
import { addRecipeIngredient } from './api';
import type { Ingredient } from '../../types/ingredient';

export function AddRecipeIngredientDialog({
  open,
  recipeId,
  excludeIngredientIds,
  onClose,
  onAdded,
}: {
  open: boolean;
  recipeId: string;
  excludeIngredientIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add ingredient</DialogTitle>
      {/* Mounted only while open, so its form state (selected ingredient,
          quantity, in-flight fetch) starts fresh every time rather than
          needing a manual reset effect — same delegation pattern as
          CreateIngredientDialog/IngredientForm. */}
      {open && (
        <AddRecipeIngredientForm
          recipeId={recipeId}
          excludeIngredientIds={excludeIngredientIds}
          onClose={onClose}
          onAdded={onAdded}
        />
      )}
    </Dialog>
  );
}

// Quantity's unit is inherited from the selected ingredient and shown
// read-only next to the input — never user-selectable (schema.md).
function AddRecipeIngredientForm({
  recipeId,
  excludeIngredientIds,
  onClose,
  onAdded,
}: {
  recipeId: string;
  excludeIngredientIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const userId = useAppStore((state) => state.userId);

  const [options, setOptions] = useState<Ingredient[] | null>(null);
  const [selected, setSelected] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchIngredients(userId).then(setOptions).catch(() => setOptions([]));
  }, [userId]);

  const availableOptions = useMemo(
    () => (options ?? []).filter((i) => !excludeIngredientIds.includes(i.id)),
    [options, excludeIngredientIds],
  );

  async function handleSubmit() {
    if (!selected) return;
    setError(null);
    setSubmitting(true);
    try {
      await addRecipeIngredient(recipeId, selected.id, Number(quantity));
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add this ingredient. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogContent sx={{ pt: '12px !important' }}>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}

          {options === null ? (
            <CircularProgress size={24} />
          ) : options.length === 0 ? (
            <Alert severity="info">Your pantry is empty. Add ingredients there first.</Alert>
          ) : (
            <>
              <Autocomplete
                options={availableOptions}
                getOptionLabel={(option) => option.name}
                value={selected}
                onChange={(_, value) => setSelected(value)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField {...params} label="Ingredient" required autoFocus />
                )}
              />
              <TextField
                label="Quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                fullWidth
                disabled={!selected}
                slotProps={{
                  htmlInput: { min: 0, step: 0.01 },
                  input: selected
                    ? {
                        endAdornment: (
                          <InputAdornment position="end">{selected.unit}</InputAdornment>
                        ),
                      }
                    : undefined,
                }}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!selected || quantity.trim() === '' || submitting}
        >
          {submitting ? 'Adding…' : 'Add ingredient'}
        </Button>
      </DialogActions>
    </>
  );
}
