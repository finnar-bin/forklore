import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useAppStore } from '../../store/useAppStore';
import { createIngredient, fetchIngredients } from '../pantry/api';
import { INGREDIENT_UNITS } from '../pantry/ingredientUnits';
import type { Ingredient, IngredientUnit } from '../../types/ingredient';

// Purely client-side — adding an *existing* ingredient to the recipe only
// updates the in-memory draft; the parent commits it (along with every
// other pending change) in one batch when the user hits the page-level Save
// button. Creating a *new* ingredient is the one exception — it's a real,
// immediate write to the personal pantry (same as the Pantry screen), since
// the ingredient itself is an independent resource with its own lifecycle.
// Only its association with this recipe gets staged into the draft.
export function AddRecipeIngredientDialog({
  open,
  excludeIngredientIds,
  onClose,
  onAdd,
}: {
  open: boolean;
  excludeIngredientIds: string[];
  onClose: () => void;
  onAdd: (ingredient: Ingredient, quantityUsed: number) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add ingredient</DialogTitle>
      {/* Mounted only while open, so its selection/quantity state starts
          fresh every time rather than needing a manual reset effect — same
          delegation pattern as CreateIngredientDialog/IngredientForm. */}
      {open && (
        <AddRecipeIngredientForm
          excludeIngredientIds={excludeIngredientIds}
          onClose={onClose}
          onAdd={onAdd}
        />
      )}
    </Dialog>
  );
}

function AddRecipeIngredientForm({
  excludeIngredientIds,
  onClose,
  onAdd,
}: {
  excludeIngredientIds: string[];
  onClose: () => void;
  onAdd: (ingredient: Ingredient, quantityUsed: number) => void;
}) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');

  return (
    <>
      <Box sx={{ px: 3, pt: 1.5 }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, value) => value && setMode(value)}
          size="small"
          fullWidth
        >
          <ToggleButton value="existing">From pantry</ToggleButton>
          <ToggleButton value="new">New ingredient</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Remounts (and so resets) on toggle — each mode owns its own state. */}
      {mode === 'existing' ? (
        <ExistingIngredientForm excludeIngredientIds={excludeIngredientIds} onClose={onClose} onAdd={onAdd} />
      ) : (
        <NewIngredientForm onClose={onClose} onAdd={onAdd} />
      )}
    </>
  );
}

// Quantity's unit is inherited from the selected ingredient and shown
// read-only next to the input — never user-selectable (schema.md).
function ExistingIngredientForm({
  excludeIngredientIds,
  onClose,
  onAdd,
}: {
  excludeIngredientIds: string[];
  onClose: () => void;
  onAdd: (ingredient: Ingredient, quantityUsed: number) => void;
}) {
  const userId = useAppStore((state) => state.userId);

  const [options, setOptions] = useState<Ingredient[] | null>(null);
  const [selected, setSelected] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    if (!userId) return;
    fetchIngredients(userId).then(setOptions).catch(() => setOptions([]));
  }, [userId]);

  const availableOptions = useMemo(
    () => (options ?? []).filter((i) => !excludeIngredientIds.includes(i.id)),
    [options, excludeIngredientIds],
  );

  const parsedQuantity = Number(quantity);
  const canAdd = selected !== null && Number.isFinite(parsedQuantity) && parsedQuantity > 0;

  function handleAdd() {
    if (!selected || !canAdd) return;
    onAdd(selected, parsedQuantity);
  }

  return (
    <>
      <DialogContent sx={{ pt: '12px !important' }}>
        <Stack spacing={2.5}>
          {options === null ? (
            <CircularProgress size={24} />
          ) : options.length === 0 ? (
            <Alert severity="info">
              Your pantry is empty. Switch to "New ingredient" to create one.
            </Alert>
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
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={!canAdd}>
          Add ingredient
        </Button>
      </DialogActions>
    </>
  );
}

// Creates a brand-new personal pantry ingredient (immediate write, same as
// CreateIngredientDialog), then stages it onto the recipe with the given
// "quantity used" — a distinct number from the ingredient's own base
// quantity (e.g. "500 g package, 620 kcal" vs. "using 150 g here").
function NewIngredientForm({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (ingredient: Ingredient, quantityUsed: number) => void;
}) {
  const userId = useAppStore((state) => state.userId);

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<IngredientUnit | ''>('');
  const [kcal, setKcal] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [quantityUsed, setQuantityUsed] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedQuantity = Number(quantity);
  const parsedKcal = Number(kcal);
  const parsedQuantityUsed = Number(quantityUsed);
  const canSubmit =
    userId !== null &&
    name.trim() !== '' &&
    unit !== '' &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0 &&
    Number.isFinite(parsedKcal) &&
    parsedKcal >= 0 &&
    Number.isFinite(parsedQuantityUsed) &&
    parsedQuantityUsed > 0;

  async function handleCreate() {
    if (!userId || !unit || !canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const created = await createIngredient(userId, {
        name: name.trim(),
        quantity: parsedQuantity,
        unit,
        kcal: parsedKcal,
        photo_url: photoUrl.trim() === '' ? null : photoUrl.trim(),
      });
      onAdd(created, parsedQuantityUsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create this ingredient. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogContent sx={{ pt: '12px !important' }}>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoFocus
            disabled={submitting}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              fullWidth
              disabled={submitting}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            />
            <TextField
              label="Unit"
              select
              value={unit}
              onChange={(e) => setUnit(e.target.value as IngredientUnit)}
              required
              fullWidth
              disabled={submitting}
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
            disabled={submitting}
            slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
          />
          <TextField
            label="Photo URL (optional)"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            fullWidth
            disabled={submitting}
          />
          <TextField
            label="Quantity used in this recipe"
            type="number"
            value={quantityUsed}
            onChange={(e) => setQuantityUsed(e.target.value)}
            required
            fullWidth
            disabled={submitting || !unit}
            slotProps={{
              htmlInput: { min: 0, step: 0.01 },
              input: unit
                ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }
                : undefined,
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleCreate} disabled={!canSubmit || submitting}>
          {submitting ? 'Creating…' : 'Create & add'}
        </Button>
      </DialogActions>
    </>
  );
}
