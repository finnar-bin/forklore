import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useAppStore } from '../../store/useAppStore';
import { fetchAllIngredients } from '../pantry/api';
import { fetchAllRecipes } from '../recipes/api';
import { useMyGroups } from '../groups/useMyGroups';
import { createLogEntry, type LogEntryInput } from './api';
import { formatIngredientLabel, formatRecipeLabel } from './formatItemLabel';
import { LogIngredientStep } from './LogIngredientStep';
import { LogRecipeStep } from './LogRecipeStep';
import type { GroupMembership } from '../../types/group';
import type { Ingredient } from '../../types/ingredient';
import type { LogEntry } from '../../types/log';
import type { Recipe } from '../../types/recipe';

// A stable reference (not a fresh `[]` literal on every render) so the
// ingredients/recipes effect below — keyed on `groups` — doesn't re-run on
// every render while useMyGroups is still loading.
const EMPTY_GROUPS: GroupMembership[] = [];

// Primary "log an entry by selecting an existing ingredient or recipe" flow
// (Ticket 8 scope). Same toggle + select-then-detail shape as
// AddRecipeIngredientDialog's "From pantry" step, applied to a type toggle
// instead of an existing/new toggle.
//
// Cross-context by design (Ticket 12 follow-up, "/log shows everything"):
// unlike the pantry/recipes tabs, this dialog doesn't take a groupId — it
// lists every ingredient/recipe the caller can see, personal and every
// group they're in, each labeled with where it lives (see groupLabel
// below). Which log the resulting entry lands on is decided by what gets
// picked (the item's own group_id), not by whichever screen the dialog was
// opened from. See docs/pending-deviations.md (Ticket 12).
export function AddLogEntryDialog({
  open,
  onClose,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  onLogged: (entry: LogEntry) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Log an entry</DialogTitle>
      {/* Mounted only while open, so selection state starts fresh each time. */}
      {open && <AddLogEntryForm onClose={onClose} onLogged={onLogged} />}
    </Dialog>
  );
}

function AddLogEntryForm({
  onClose,
  onLogged,
}: {
  onClose: () => void;
  onLogged: (entry: LogEntry) => void;
}) {
  const userId = useAppStore((state) => state.userId);
  const [type, setType] = useState<'ingredient' | 'recipe'>('ingredient');

  // Shared cache (see useMyGroups) rather than this dialog's own fetch — it
  // remounts fresh every time it opens ("selection state starts fresh each
  // time" above), which used to mean a fresh group_members fetch every tap
  // of the Log FAB.
  const groups = useMyGroups(userId) ?? EMPTY_GROUPS;
  const [ingredients, setIngredients] = useState<Ingredient[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!userId) return;
    const groupIds = groups.map((membership) => membership.group.id);
    fetchAllIngredients(userId, groupIds).then(setIngredients).catch(() => setIngredients([]));
    fetchAllRecipes(userId, groupIds).then(setRecipes).catch(() => setRecipes([]));
  }, [userId, groups]);

  function groupLabel(groupId: string | null): string {
    if (groupId === null) return 'Personal';
    return groups.find((membership) => membership.group.id === groupId)?.group.name ?? 'Group';
  }

  async function handleLog(groupId: string | null, input: LogEntryInput) {
    if (!userId) return;
    const entry = await createLogEntry(userId, groupId, input);
    onLogged(entry);
  }

  if (type === 'ingredient' && selectedIngredient) {
    return (
      <LogIngredientStep
        ingredient={selectedIngredient}
        onLog={(input) => handleLog(selectedIngredient.group_id, input)}
        onCancel={() => setSelectedIngredient(null)}
      />
    );
  }

  if (type === 'recipe' && selectedRecipe) {
    return (
      <LogRecipeStep
        recipe={selectedRecipe}
        onLog={(input) => handleLog(selectedRecipe.group_id, input)}
        onCancel={() => setSelectedRecipe(null)}
      />
    );
  }

  return (
    <>
    <DialogContent sx={{ pt: '12px !important' }}>
      <Stack spacing={2.5}>
        <ToggleButtonGroup
          value={type}
          exclusive
          onChange={(_, value) => value && setType(value)}
          size="small"
          fullWidth
        >
          <ToggleButton value="ingredient">Ingredient</ToggleButton>
          <ToggleButton value="recipe">Recipe</ToggleButton>
        </ToggleButtonGroup>

        {type === 'ingredient' ? (
          ingredients === null ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : ingredients.length === 0 ? (
            <Alert severity="info">Your pantry is empty. Add an ingredient first.</Alert>
          ) : (
            <Autocomplete
              options={ingredients}
              getOptionLabel={formatIngredientLabel}
              onChange={(_, value) => setSelectedIngredient(value)}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderOption={({ key, ...props }, option) => (
                <Box component="li" key={key} {...props}>
                  <Stack sx={{ minWidth: 0 }}>
                    <Typography fontSize={14} noWrap>
                      {formatIngredientLabel(option)}
                    </Typography>
                    <Typography fontSize={11} color="text.secondary" noWrap>
                      {groupLabel(option.group_id)}
                    </Typography>
                  </Stack>
                </Box>
              )}
              renderInput={(params) => <TextField {...params} label="Ingredient" autoFocus />}
            />
          )
        ) : recipes === null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : recipes.length === 0 ? (
          <Alert severity="info">Your recipes are empty. Add a recipe first.</Alert>
        ) : (
          <Autocomplete
            options={recipes}
            getOptionLabel={formatRecipeLabel}
            onChange={(_, value) => setSelectedRecipe(value)}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderOption={({ key, ...props }, option) => (
              <Box component="li" key={key} {...props}>
                <Stack sx={{ minWidth: 0 }}>
                  <Typography fontSize={14} noWrap>
                    {formatRecipeLabel(option)}
                  </Typography>
                  <Typography fontSize={11} color="text.secondary" noWrap>
                    {groupLabel(option.group_id)}
                  </Typography>
                </Stack>
              </Box>
            )}
            renderInput={(params) => <TextField {...params} label="Recipe" autoFocus />}
          />
        )}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
    </DialogActions>
    </>
  );
}
