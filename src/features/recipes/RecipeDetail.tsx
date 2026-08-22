import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
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
import { ItemMetadata } from '../../components/ItemMetadata';
import { useAppStore } from '../../store/useAppStore';
import { useProfileNames } from '../profiles/useProfileNames';
import {
  addRecipeIngredient,
  deleteRecipe,
  fetchRecipe,
  fetchRecipeIngredients,
  refreshRecipeFromServer,
  removeRecipeIngredient,
  updateRecipe,
  updateRecipeIngredientQuantity,
} from './api';
import { DeleteRecipeDialog } from './DeleteRecipeDialog';
import { RecipeIngredientsList } from './RecipeIngredientsList';
import type { Recipe, RecipeIngredientDetail } from '../../types/recipe';
import type { Ingredient } from '../../types/ingredient';

// Distinguishes "still loading" from "query resolved, nothing found" — see
// the same pattern in IngredientDetail.tsx.
const LOADING = Symbol('loading');

// Everything on this screen (recipe fields + ingredient lines) is staged
// client-side in `name`/`servings`/`photoUrl`/`ingredients` and only written
// on Save. The recipe's own fields (name/servings/photo) read from and write
// to Dexie — offline-capable, per this ticket. The ingredient lines
// (recipe_ingredients) are not mirrored in Dexie and still read/write
// straight to Supabase — total_kcal is only ever correct once recalculated
// by the server-side trigger, so there's no offline-correct way to stage
// those edits locally. See docs/pending-deviations.md (Ticket 10).
// `savedRecipe`/`savedIngredients` hold the last persisted snapshot, used
// both to diff what actually changed at save time and to know whether
// there's anything to save at all.
export function RecipeDetail({ groupId, backPath }: { groupId: string | null; backPath: string }) {
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const userId = useAppStore((state) => state.userId);
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const recipeResult = useLiveQuery(
    () => (recipeId ? fetchRecipe(recipeId) : undefined),
    [recipeId],
    LOADING,
  );
  const recipeLoading = recipeResult === LOADING;
  const recipe = recipeResult === LOADING ? undefined : recipeResult;

  const [savedRecipe, setSavedRecipe] = useState<Recipe | null>(null);
  const [savedIngredients, setSavedIngredients] = useState<RecipeIngredientDetail[]>([]);

  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [photoUrl, setPhotoUrl] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredientDetail[]>([]);

  const [ingredientsLoading, setIngredientsLoading] = useState(true);
  const [ingredientsError, setIngredientsError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);

  // Group-context metadata only, read from the last-persisted baseline
  // (not the live draft) — see docs/pending-deviations.md (Ticket 12). `!=
  // null` (not `!== null`) so a pre-migration Dexie row that's missing
  // `updated_by` entirely (`undefined`, not `null` — see useProfileNames)
  // doesn't slip through.
  const profileIds =
    groupId && savedRecipe
      ? [savedRecipe.created_by, savedRecipe.updated_by].filter((id) => id != null)
      : [];
  const profileNames = useProfileNames(profileIds);
  const wasUpdated = savedRecipe?.updated_by != null;

  function applyRecipeBaseline(next: Recipe) {
    setSavedRecipe(next);
    setName(next.name);
    setServings(next.servings.toString());
    setPhotoUrl(next.photo_url ?? '');
  }

  // Seeds the draft from Dexie once per recipe, not on every live-query
  // update — a background pull landing mid-edit must not clobber unsaved
  // changes. Adjusted directly during render (React's documented pattern for
  // resetting state when an id changes) rather than in an effect, since
  // `recipe` is already available synchronously — no extra render/effect
  // round trip needed. Re-seeding after our own save happens explicitly, in
  // handleSave.
  if (recipe && savedRecipe?.id !== recipe.id) {
    applyRecipeBaseline(recipe);
  }

  // recipe_ingredients isn't mirrored in Dexie (see file header) — this is a
  // one-shot network load per recipe, independent of the Dexie-backed recipe
  // fields above so a slow/offline connection doesn't block the rest of the
  // page from rendering.
  useEffect(() => {
    if (!recipeId) return;
    setIngredientsLoading(true);
    setIngredientsError(null);
    fetchRecipeIngredients(recipeId)
      .then((rows) => {
        setSavedIngredients(rows);
        setIngredients(rows);
      })
      .catch((err) =>
        setIngredientsError(
          err instanceof Error ? err.message : "Couldn't load this recipe's ingredients.",
        ),
      )
      .finally(() => setIngredientsLoading(false));
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
    navigate(backPath, { replace: true });
  }

  async function handleSave() {
    if (!recipeId || !savedRecipe || !userId) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Recipe-field-only changes go through Dexie + the outbox — this
      // succeeds offline, same as the Pantry/Log screens.
      const normalizedPhoto = photoUrl.trim() === '' ? null : photoUrl.trim();
      const fieldsChanged =
        name !== savedRecipe.name ||
        servingsNum !== savedRecipe.servings ||
        normalizedPhoto !== savedRecipe.photo_url;
      if (fieldsChanged) {
        const updated = await updateRecipe(recipeId, userId, {
          name,
          servings: servingsNum,
          photo_url: normalizedPhoto,
        });
        applyRecipeBaseline(updated);
      }

      // Ingredient-line changes require connectivity (see file header).
      const ops: Promise<unknown>[] = [];
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

      if (ops.length > 0) {
        const results = await Promise.allSettled(ops);
        const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

        // Refetch regardless of partial failure — some ops may have landed
        // even if others didn't, and total_kcal is only ever correct once
        // the server's trigger has recalculated it.
        try {
          const [nextRecipe, nextIngredients] = await Promise.all([
            refreshRecipeFromServer(recipeId),
            fetchRecipeIngredients(recipeId),
          ]);
          applyRecipeBaseline(nextRecipe);
          setSavedIngredients(nextIngredients);
          setIngredients(nextIngredients);
        } catch {
          // Offline or a Supabase error refreshing — keep whatever baseline
          // we already have; the field-only update above (if any) already
          // landed via the outbox regardless of this failing.
        }

        if (failed.length > 0) {
          throw new Error(
            `${failed.length} of ${ops.length} ingredient change${ops.length === 1 ? '' : 's'} failed to save — this usually means you're offline. Try again once you're back online.`,
          );
        }
      }

      setJustSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (recipeLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!savedRecipe) {
    return (
      <Box sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
        <Alert severity="error">Recipe not found.</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, mx: 'auto', pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <PhotoThumbnail photoUrl={photoUrl.trim() === '' ? null : photoUrl.trim()} alt={name} size={120} />
      </Box>

      {groupId && (
        <ItemMetadata
          creatorName={profileNames[savedRecipe.created_by]}
          createdAt={savedRecipe.created_at}
          updaterName={savedRecipe.updated_by ? profileNames[savedRecipe.updated_by] : undefined}
          updatedAt={savedRecipe.updated_at}
          wasUpdated={wasUpdated}
        />
      )}

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

      {ingredientsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : ingredientsError ? (
        <Alert severity="error">{ingredientsError}</Alert>
      ) : (
        <RecipeIngredientsList
          groupId={groupId}
          ingredients={ingredients}
          disabled={saving}
          onAdd={handleAddIngredient}
          onQuantityChange={handleQuantityChange}
          onRemove={handleRemoveIngredient}
        />
      )}

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
