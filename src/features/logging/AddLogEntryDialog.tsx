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
import { useAppStore } from '../../store/useAppStore';
import { fetchIngredients } from '../pantry/api';
import { fetchRecipes } from '../recipes/api';
import { createLogEntry, type LogEntryInput } from './api';
import { LogIngredientStep } from './LogIngredientStep';
import { LogRecipeStep } from './LogRecipeStep';
import type { Ingredient } from '../../types/ingredient';
import type { LogEntry } from '../../types/log';
import type { Recipe } from '../../types/recipe';

// Primary "log an entry by selecting an existing ingredient or recipe" flow
// (Ticket 8 scope). Same toggle + select-then-detail shape as
// AddRecipeIngredientDialog's "From pantry" step, applied to a type toggle
// instead of an existing/new toggle.
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

  const [ingredients, setIngredients] = useState<Ingredient[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetchIngredients(userId).then(setIngredients).catch(() => setIngredients([]));
    fetchRecipes(userId).then(setRecipes).catch(() => setRecipes([]));
  }, [userId]);

  async function handleLog(input: LogEntryInput) {
    if (!userId) return;
    const entry = await createLogEntry(userId, input);
    onLogged(entry);
  }

  if (type === 'ingredient' && selectedIngredient) {
    return (
      <LogIngredientStep
        ingredient={selectedIngredient}
        onLog={handleLog}
        onCancel={() => setSelectedIngredient(null)}
      />
    );
  }

  if (type === 'recipe' && selectedRecipe) {
    return <LogRecipeStep recipe={selectedRecipe} onLog={handleLog} onCancel={() => setSelectedRecipe(null)} />;
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
              getOptionLabel={(option) => option.name}
              onChange={(_, value) => setSelectedIngredient(value)}
              isOptionEqualToValue={(option, value) => option.id === value.id}
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
            getOptionLabel={(option) => option.name}
            onChange={(_, value) => setSelectedRecipe(value)}
            isOptionEqualToValue={(option, value) => option.id === value.id}
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
