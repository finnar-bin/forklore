import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import type { Ingredient } from '../../types/ingredient';

export function IngredientDetail() {
  const { ingredientId } = useParams<{ ingredientId: string }>();
  const navigate = useNavigate();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const [ingredient, setIngredient] = useState<Ingredient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!ingredientId) return;
    fetchIngredient(ingredientId)
      .then(setIngredient)
      .catch((err) => setError(err instanceof Error ? err.message : 'Ingredient not found.'))
      .finally(() => setLoading(false));
  }, [ingredientId]);

  async function handleSubmit(input: IngredientInput) {
    if (!ingredientId) return;
    const updated = await updateIngredient(ingredientId, input);
    setIngredient(updated);
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

  if (error || !ingredient) {
    return (
      <Box sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
        <Alert severity="error">{error ?? 'Ingredient not found.'}</Alert>
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
