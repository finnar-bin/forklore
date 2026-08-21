import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { PhotoThumbnail } from '../../components/PhotoThumbnail';
import {
  addRecipeIngredient,
  deleteRecipe,
  fetchRecipe,
  fetchRecipeIngredients,
  removeRecipeIngredient,
  updateRecipe,
  updateRecipeIngredientQuantity,
} from './api';
import { DeleteRecipeDialog } from './DeleteRecipeDialog';
import { RecipeIngredientsList } from './RecipeIngredientsList';
import type { Recipe, RecipeIngredientDetail } from '../../types/recipe';
import type { Ingredient } from '../../types/ingredient';

// Everything on this screen (recipe fields + ingredient lines) is staged
// client-side in `name`/`servings`/`photoUrl`/`ingredients` and only written
// to Supabase as one batch when Save is clicked — nothing here makes a
// network call on its own. `savedRecipe`/`savedIngredients` hold the last
// persisted snapshot, used both to diff what actually changed at save time
// and to know whether there's anything to save at all.
export function RecipeDetail() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const [savedRecipe, setSavedRecipe] = useState<Recipe | null>(null);
  const [savedIngredients, setSavedIngredients] = useState<RecipeIngredientDetail[]>([]);

  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [photoUrl, setPhotoUrl] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredientDetail[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!recipeId) return;
    Promise.all([fetchRecipe(recipeId), fetchRecipeIngredients(recipeId)])
      .then(([nextRecipe, nextIngredients]) => {
        setSavedRecipe(nextRecipe);
        setSavedIngredients(nextIngredients);
        setName(nextRecipe.name);
        setServings(nextRecipe.servings.toString());
        setPhotoUrl(nextRecipe.photo_url ?? '');
        setIngredients(nextIngredients);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Recipe not found.'))
      .finally(() => setLoading(false));
  }, [recipeId]);

  const servingsNum = Number(servings);

  // Realtime — recomputed on every keystroke/add/remove from the draft
  // ingredient list, not read from the persisted recipe row. Uses the same
  // formula as the recalculate_recipe_kcal trigger (schema.md), so it
  // matches what the server will compute once saved.
  const totalKcal = useMemo(
    () =>
      ingredients.reduce(
        (sum, item) => sum + (item.quantity > 0 ? (item.kcal * item.quantity_used) / item.quantity : 0),
        0,
      ),
    [ingredients],
  );
  const perServing = servingsNum > 0 ? totalKcal / servingsNum : 0;

  const isDirty = useMemo(() => {
    if (!savedRecipe) return false;
    const normalizedPhoto = photoUrl.trim() === '' ? null : photoUrl.trim();
    if (name !== savedRecipe.name) return true;
    if (servingsNum !== savedRecipe.servings) return true;
    if (normalizedPhoto !== savedRecipe.photo_url) return true;
    if (ingredients.length !== savedIngredients.length) return true;
    return ingredients.some((item) => {
      const prev = savedIngredients.find((s) => s.ingredient_id === item.ingredient_id);
      return !prev || prev.quantity_used !== item.quantity_used;
    });
  }, [name, servingsNum, photoUrl, ingredients, savedRecipe, savedIngredients]);

  const isValid = name.trim() !== '' && Number.isFinite(servingsNum) && servingsNum >= 1;

  function handleAddIngredient(ingredient: Ingredient, quantityUsed: number) {
    setIngredients((prev) => [
      ...prev,
      {
        ingredient_id: ingredient.id,
        quantity_used: quantityUsed,
        name: ingredient.name,
        unit: ingredient.unit,
        kcal: ingredient.kcal,
        quantity: ingredient.quantity,
      },
    ]);
  }

  function handleQuantityChange(ingredientId: string, quantityUsed: number) {
    setIngredients((prev) =>
      prev.map((item) => (item.ingredient_id === ingredientId ? { ...item, quantity_used: quantityUsed } : item)),
    );
  }

  function handleRemoveIngredient(ingredientId: string) {
    setIngredients((prev) => prev.filter((item) => item.ingredient_id !== ingredientId));
  }

  async function handleDelete() {
    if (!recipeId) return;
    await deleteRecipe(recipeId);
    navigate('/recipes', { replace: true });
  }

  async function handleSave() {
    if (!recipeId || !savedRecipe) return;
    setSaving(true);
    setSaveError(null);
    try {
      const ops: Promise<unknown>[] = [];

      const normalizedPhoto = photoUrl.trim() === '' ? null : photoUrl.trim();
      const fieldsChanged =
        name !== savedRecipe.name ||
        servingsNum !== savedRecipe.servings ||
        normalizedPhoto !== savedRecipe.photo_url;
      if (fieldsChanged) {
        ops.push(updateRecipe(recipeId, { name, servings: servingsNum, photo_url: normalizedPhoto }));
      }

      const draftIds = new Set(ingredients.map((i) => i.ingredient_id));
      for (const saved of savedIngredients) {
        if (!draftIds.has(saved.ingredient_id)) {
          ops.push(removeRecipeIngredient(recipeId, saved.ingredient_id));
        }
      }
      for (const item of ingredients) {
        const prev = savedIngredients.find((s) => s.ingredient_id === item.ingredient_id);
        if (!prev) {
          ops.push(addRecipeIngredient(recipeId, item.ingredient_id, item.quantity_used));
        } else if (prev.quantity_used !== item.quantity_used) {
          ops.push(updateRecipeIngredientQuantity(recipeId, item.ingredient_id, item.quantity_used));
        }
      }

      const results = await Promise.allSettled(ops);
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed.length > 0) {
        throw new Error(
          `${failed.length} of ${ops.length} change${ops.length === 1 ? '' : 's'} failed to save. Try again.`,
        );
      }

      // Refetch rather than trust the payload we just sent — total_kcal is
      // recalculated server-side by the recalculate_recipe_kcal trigger.
      const [nextRecipe, nextIngredients] = await Promise.all([
        fetchRecipe(recipeId),
        fetchRecipeIngredients(recipeId),
      ]);
      setSavedRecipe(nextRecipe);
      setSavedIngredients(nextIngredients);
      setName(nextRecipe.name);
      setServings(nextRecipe.servings.toString());
      setPhotoUrl(nextRecipe.photo_url ?? '');
      setIngredients(nextIngredients);
      setJustSaved(true);
    } catch (err) {
      // Some ops may have landed before the failure — refresh the saved
      // baseline (not the user's in-progress draft) so a retry only
      // reapplies whatever's actually still outstanding.
      try {
        const [nextRecipe, nextIngredients] = await Promise.all([
          fetchRecipe(recipeId),
          fetchRecipeIngredients(recipeId),
        ]);
        setSavedRecipe(nextRecipe);
        setSavedIngredients(nextIngredients);
      } catch {
        // Keep the previous baseline if even this fails.
      }
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError || !savedRecipe) {
    return (
      <Box sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
        <Alert severity="error">{loadError ?? 'Recipe not found.'}</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, mx: 'auto', pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <PhotoThumbnail photoUrl={photoUrl.trim() === '' ? null : photoUrl.trim()} alt={name} size={120} />
      </Box>

      {/* Stat tiles matching the total/per-serving kcal pattern from
          docs/mocks/recipe-detail-*.png. Computed live from the draft
          ingredient list (see totalKcal above) rather than read from
          savedRecipe.total_kcal, so it updates as the user edits, before
          anything is saved. */}
      <Stack direction="row" spacing={1.5}>
        <Paper sx={{ flex: 1, p: 1.5, textAlign: 'center', borderRadius: '12px', boxShadow: tokens.sh1 }}>
          <Typography fontSize={18} fontWeight={500} color="primary.main">
            {totalKcal.toFixed(0)}
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
        <Stack spacing={2.5}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            disabled={saving}
          />
          <TextField
            label="Servings"
            type="number"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            required
            fullWidth
            disabled={saving}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
          />
          <TextField
            label="Photo URL (optional)"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            fullWidth
            disabled={saving}
          />
        </Stack>
      </Paper>

      <RecipeIngredientsList
        ingredients={ingredients}
        disabled={saving}
        onAdd={handleAddIngredient}
        onQuantityChange={handleQuantityChange}
        onRemove={handleRemoveIngredient}
      />

      {saveError && <Alert severity="error">{saveError}</Alert>}

      <Button
        variant="contained"
        size="large"
        onClick={handleSave}
        disabled={!isValid || !isDirty || saving}
      >
        {saving ? 'Saving…' : 'Save changes'}
      </Button>

      <Button color="error" variant="outlined" size="large" onClick={() => setDeleteOpen(true)}>
        Delete recipe
      </Button>

      <DeleteRecipeDialog
        open={deleteOpen}
        recipeName={savedRecipe.name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      <Snackbar
        open={justSaved}
        autoHideDuration={3000}
        onClose={() => setJustSaved(false)}
        message="Recipe saved"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Stack>
  );
}
