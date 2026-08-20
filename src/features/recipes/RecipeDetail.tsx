import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { PhotoThumbnail } from '../../components/PhotoThumbnail';
import {
  fetchRecipe,
  fetchRecipeIngredients,
  updateRecipe,
  type RecipeIngredientDetail,
  type RecipeInput,
} from './api';
import { RecipeForm } from './RecipeForm';
import { RecipeIngredientsList } from './RecipeIngredientsList';
import type { Recipe } from '../../types/recipe';

export function RecipeDetail() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredientDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!recipeId) return;
    const [nextRecipe, nextIngredients] = await Promise.all([
      fetchRecipe(recipeId),
      fetchRecipeIngredients(recipeId),
    ]);
    setRecipe(nextRecipe);
    setIngredients(nextIngredients);
  }, [recipeId]);

  useEffect(() => {
    if (!recipeId) return;
    Promise.all([fetchRecipe(recipeId), fetchRecipeIngredients(recipeId)])
      .then(([nextRecipe, nextIngredients]) => {
        setRecipe(nextRecipe);
        setIngredients(nextIngredients);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Recipe not found.'))
      .finally(() => setLoading(false));
  }, [recipeId]);

  async function handleSubmit(input: RecipeInput) {
    if (!recipeId) return;
    await updateRecipe(recipeId, input);
    await reload();
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !recipe) {
    return (
      <Box sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
        <Alert severity="error">{error ?? 'Recipe not found.'}</Alert>
      </Box>
    );
  }

  const perServing = recipe.servings > 0 ? recipe.total_kcal / recipe.servings : 0;

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <PhotoThumbnail photoUrl={recipe.photo_url} alt={recipe.name} size={120} />
      </Box>

      {/* Stat tiles matching the total/per-serving kcal pattern from
          docs/mocks/recipe-detail-*.png. Reads recipe.total_kcal directly —
          never computed client-side — so it reflects the recalc trigger. */}
      <Stack direction="row" spacing={1.5}>
        <Paper sx={{ flex: 1, p: 1.5, textAlign: 'center', borderRadius: '12px', boxShadow: tokens.sh1 }}>
          <Typography fontSize={18} fontWeight={500} color="primary.main">
            {recipe.total_kcal}
          </Typography>
          <Typography fontSize={11} color="text.secondary">
            total kcal
          </Typography>
        </Paper>
        <Paper sx={{ flex: 1, p: 1.5, textAlign: 'center', borderRadius: '12px', boxShadow: tokens.sh1 }}>
          <Typography fontSize={18} fontWeight={500} color="primary.main">
            {perServing.toFixed(0)}
          </Typography>
          <Typography fontSize={11} color="text.secondary">
            per serving
          </Typography>
        </Paper>
      </Stack>

      <Paper sx={{ p: 3, borderRadius: '14px', boxShadow: tokens.sh2 }}>
        <RecipeForm
          initialValues={{ name: recipe.name, servings: recipe.servings, photo_url: recipe.photo_url }}
          submitLabel="Save changes"
          onSubmit={handleSubmit}
        />
      </Paper>

      <RecipeIngredientsList recipeId={recipe.id} ingredients={ingredients} onChanged={reload} />
    </Stack>
  );
}
