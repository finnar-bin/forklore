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
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useAppStore } from '../../store/useAppStore';
import { kcalPerUnit } from '../../lib/kcal';
import { useMyGroups } from '../groups/useMyGroups';
import { useMyProfile } from '../profiles/useMyProfile';
import { createIngredient, fetchIngredients, type IngredientInput } from '../pantry/api';
import { IngredientAutocompleteOption } from '../pantry/IngredientAutocompleteOption';
import { IngredientForm } from '../pantry/IngredientForm';
import { IngredientKcalHeader } from '../pantry/IngredientKcalHeader';
import type { Ingredient } from '../../types/ingredient';

// Purely client-side — adding an *existing* ingredient to the recipe only
// updates the in-memory draft; the parent commits it (along with every
// other pending change) in one batch when the user hits the page-level Save
// button. Creating a *new* ingredient is the one exception — it's a real,
// immediate write to the personal pantry (same as the Pantry screen), since
// the ingredient itself is an independent resource with its own lifecycle.
// Only its association with this recipe gets staged into the draft.
export function AddRecipeIngredientDialog({
  open,
  groupId,
  excludeIngredientIds,
  onClose,
  onAdd,
}: {
  open: boolean;
  groupId: string | null;
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
          groupId={groupId}
          excludeIngredientIds={excludeIngredientIds}
          onClose={onClose}
          onAdd={onAdd}
        />
      )}
    </Dialog>
  );
}

function AddRecipeIngredientForm({
  groupId,
  excludeIngredientIds,
  onClose,
  onAdd,
}: {
  groupId: string | null;
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
        <ExistingIngredientForm
          groupId={groupId}
          excludeIngredientIds={excludeIngredientIds}
          onClose={onClose}
          onAdd={onAdd}
        />
      ) : (
        <NewIngredientForm groupId={groupId} onClose={onClose} onAdd={onAdd} />
      )}
    </>
  );
}

// Quantity's unit is inherited from the selected ingredient and shown
// read-only next to the input — never user-selectable (schema.md).
function ExistingIngredientForm({
  groupId,
  excludeIngredientIds,
  onClose,
  onAdd,
}: {
  groupId: string | null;
  excludeIngredientIds: string[];
  onClose: () => void;
  onAdd: (ingredient: Ingredient, quantityUsed: number) => void;
}) {
  const userId = useAppStore((state) => state.userId);

  // This recipe's own context opt-in — see docs/pending-deviations.md
  // ("Community pantry") and PantryList.tsx's identical derivation.
  const profile = useMyProfile(userId);
  const groups = useMyGroups(userId);
  const membership = groupId ? (groups ?? []).find((m) => m.group.id === groupId) : undefined;
  const communityEnabled = groupId
    ? membership?.group.community_pantry_enabled ?? false
    : profile?.community_pantry_enabled ?? false;

  // fetchIngredients only ever returns this recipe's own context (personal
  // or `groupId`) plus, when opted in, every community ingredient merged in
  // (see docs/pending-deviations.md, "Community pantry") — so unlike
  // AddLogEntryDialog's cross-context picker, every non-community option
  // here is already known to belong to the same place; only "Community" vs.
  // this context's own name needs distinguishing, so a same-named community
  // ingredient and a context-owned one aren't indistinguishable in the list.
  function groupLabel(isCommunity: boolean): string {
    if (isCommunity) return 'Community';
    return groupId ? membership?.group.name ?? 'Group' : 'Personal';
  }

  const [options, setOptions] = useState<Ingredient[] | null>(null);
  const [selected, setSelected] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    if (!userId) return;
    fetchIngredients(userId, groupId, communityEnabled).then(setOptions).catch(() => setOptions([]));
  }, [userId, groupId, communityEnabled]);

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
              {groupId ? "This group's pantry" : 'Your pantry'} is empty. Switch to "New ingredient" to
              create one.
            </Alert>
          ) : (
            <>
              {selected && (
                <IngredientKcalHeader
                  ingredient={selected}
                  groupLabel={groupLabel(selected.is_community)}
                  kcal={kcalPerUnit(selected.kcal, selected.quantity) * parsedQuantity}
                />
              )}
              <Autocomplete
                options={availableOptions}
                getOptionKey={(option) => option.id}
                getOptionLabel={(option) => option.name}
                value={selected}
                onChange={(_, value) => setSelected(value)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderOption={({ key, ...liProps }, option) => (
                  <IngredientAutocompleteOption
                    key={key}
                    liProps={liProps}
                    ingredient={option}
                    groupLabel={groupLabel(option.is_community)}
                  />
                )}
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

// Two steps, reusing the same IngredientForm the Pantry screen uses (rather
// than duplicating its fields): (1) define and create the ingredient itself
// — an immediate write to the same context (personal or group) this recipe
// belongs to, same as CreateIngredientDialog — then (2) a recipe-specific
// "quantity used" step, since that's a distinct
// number from the ingredient's own base quantity (e.g. "500 g package, 620
// kcal" vs. "using 150 g here") that IngredientForm has no reason to know
// about. Only step 2's result is staged onto the recipe draft.
function NewIngredientForm({
  groupId,
  onClose,
  onAdd,
}: {
  groupId: string | null;
  onClose: () => void;
  onAdd: (ingredient: Ingredient, quantityUsed: number) => void;
}) {
  const userId = useAppStore((state) => state.userId);
  const [created, setCreated] = useState<Ingredient | null>(null);
  // Generated up front (not by createIngredient) so a staged photo can be
  // uploaded under this same id before the row itself exists — see
  // IngredientForm.tsx/DeferredPhotoUpload.tsx.
  const [pendingId] = useState(() => crypto.randomUUID());

  async function handleCreate(input: IngredientInput) {
    if (!userId) return;
    const ingredient = await createIngredient(pendingId, userId, groupId, input);
    setCreated(ingredient);
  }

  if (!created) {
    return (
      <DialogContent sx={{ pt: '12px !important' }}>
        <IngredientForm ingredientId={pendingId} submitLabel="Create ingredient" onSubmit={handleCreate} />
      </DialogContent>
    );
  }

  return <RecipeQuantityStep ingredient={created} groupId={groupId} onClose={onClose} onAdd={onAdd} />;
}

function RecipeQuantityStep({
  ingredient,
  groupId,
  onClose,
  onAdd,
}: {
  ingredient: Ingredient;
  groupId: string | null;
  onClose: () => void;
  onAdd: (ingredient: Ingredient, quantityUsed: number) => void;
}) {
  const [quantityUsed, setQuantityUsed] = useState('');
  const parsedQuantityUsed = Number(quantityUsed);
  const canAdd = Number.isFinite(parsedQuantityUsed) && parsedQuantityUsed > 0;

  return (
    <>
      <DialogContent sx={{ pt: '12px !important' }}>
        <Stack spacing={2.5}>
          <Alert severity="success">
            {ingredient.name} added to {groupId ? "this group's pantry" : 'your pantry'}.
          </Alert>
          <TextField
            label="Quantity used in this recipe"
            type="number"
            value={quantityUsed}
            onChange={(e) => setQuantityUsed(e.target.value)}
            required
            fullWidth
            autoFocus
            slotProps={{
              htmlInput: { min: 0, step: 0.01 },
              input: { endAdornment: <InputAdornment position="end">{ingredient.unit}</InputAdornment> },
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onAdd(ingredient, parsedQuantityUsed)}
          disabled={!canAdd}
        >
          Add to recipe
        </Button>
      </DialogActions>
    </>
  );
}
