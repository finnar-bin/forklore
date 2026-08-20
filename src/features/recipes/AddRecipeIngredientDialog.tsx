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
import type { Ingredient } from '../../types/ingredient';

// Purely client-side — adds to the in-memory draft only. The parent commits
// this (along with every other pending change) in one batch when the user
// hits the page-level Save button.
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

// Quantity's unit is inherited from the selected ingredient and shown
// read-only next to the input — never user-selectable (schema.md).
function AddRecipeIngredientForm({
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
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={!canAdd}>
          Add ingredient
        </Button>
      </DialogActions>
    </>
  );
}
