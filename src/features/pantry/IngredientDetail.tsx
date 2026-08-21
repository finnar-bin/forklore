import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { deleteIngredient, fetchIngredient, updateIngredient, type IngredientInput } from './api';
import { IngredientForm } from './IngredientForm';
import { DeleteIngredientDialog } from './DeleteIngredientDialog';

// Distinguishes "still loading" from "query resolved, nothing found" —
// fetchIngredient resolves to undefined in both cases, so useLiveQuery needs
// a distinct default value to tell them apart (Dexie's documented pattern
// for this: https://dexie.org/docs/dexie-react-hooks/useLiveQuery()).
const LOADING = Symbol('loading');

export function IngredientDetail() {
  const { ingredientId } = useParams<{ ingredientId: string }>();
  const navigate = useNavigate();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const [deleteOpen, setDeleteOpen] = useState(false);

  const result = useLiveQuery(
    () => (ingredientId ? fetchIngredient(ingredientId) : undefined),
    [ingredientId],
    LOADING,
  );
  const loading = result === LOADING;
  const ingredient = result === LOADING ? undefined : result;

  async function handleSubmit(input: IngredientInput) {
    if (!ingredientId) return;
    await updateIngredient(ingredientId, input);
    // Back to the list on success — its live query picks up the change
    // automatically. On error, IngredientForm surfaces it and we stay put.
    navigate('/pantry', { replace: true });
  }

  async function handleDelete() {
    if (!ingredientId) return;
    await deleteIngredient(ingredientId);
    navigate('/pantry', { replace: true });
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!ingredient) {
    return (
      <Box sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
        <Alert severity="error">Ingredient not found.</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
      <Paper sx={{ p: 3, borderRadius: '14px', boxShadow: tokens.sh2 }}>
        <IngredientForm
          initialValues={{
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            kcal: ingredient.kcal,
            photo_url: ingredient.photo_url,
          }}
          submitLabel="Save changes"
          onSubmit={handleSubmit}
        />
      </Paper>

      <Button color="error" variant="outlined" size="large" onClick={() => setDeleteOpen(true)}>
        Delete ingredient
      </Button>

      <DeleteIngredientDialog
        open={deleteOpen}
        ingredientId={ingredient.id}
        ingredientName={ingredient.name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </Stack>
  );
}
