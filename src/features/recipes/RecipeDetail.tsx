import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import Paper from "@mui/material/Paper";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../../theme/theme";
import { DeferredPhotoUpload } from "../../components/DeferredPhotoUpload";
import { ItemMetadata } from "../../components/ItemMetadata";
import { formatKcalPerUnit, kcalPerUnit } from "../../lib/kcal";
import { deletePhoto, uploadPhoto } from "../../lib/photoUpload";
import { useAppStore } from "../../store/useAppStore";
import { useProfileNames } from "../profiles/useProfileNames";
import {
  addRecipeIngredient,
  deleteRecipe,
  fetchRecipe,
  fetchRecipeIngredients,
  refreshRecipeFromServer,
  removeRecipeIngredient,
  updateRecipe,
  updateRecipeIngredientQuantity,
} from "./api";
import { CopyRecipeDialog } from "./CopyRecipeDialog";
import { DeleteRecipeDialog } from "./DeleteRecipeDialog";
import { RecipeIngredientsList } from "./RecipeIngredientsList";
import type {
  Recipe,
  RecipeIngredientDetail,
  WeightUnit,
} from "../../types/recipe";
import type { Ingredient } from "../../types/ingredient";

// Distinguishes "still loading" from "query resolved, nothing found" — see
// the same pattern in IngredientDetail.tsx.
const LOADING = Symbol("loading");

// Everything on this screen (recipe fields + ingredient lines) is staged
// client-side in `name`/`weight`/`weightUnit`/`photoUrl`/`ingredients` and
// only written on Save. The recipe's own fields (name/weight/photo) read
// from and write to Dexie — offline-capable, per this ticket. The ingredient lines
// (recipe_ingredients) are not mirrored in Dexie and still read/write
// straight to Supabase — total_kcal is only ever correct once recalculated
// by the server-side trigger, so there's no offline-correct way to stage
// those edits locally. See docs/pending-deviations.md (Ticket 10).
// `savedRecipe`/`savedIngredients` hold the last persisted snapshot, used
// both to diff what actually changed at save time and to know whether
// there's anything to save at all.
export function RecipeDetail({
  groupId,
  backPath,
}: {
  groupId: string;
  backPath: string;
}) {
  const { recipeId } = useParams<{ recipeId: string }>();
  const navigate = useNavigate();
  const userId = useAppStore((state) => state.userId);
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  const recipeResult = useLiveQuery(
    () => (recipeId ? fetchRecipe(recipeId) : undefined),
    [recipeId],
    LOADING,
  );
  const recipeLoading = recipeResult === LOADING;
  const recipe = recipeResult === LOADING ? undefined : recipeResult;

  const [savedRecipe, setSavedRecipe] = useState<Recipe | null>(null);
  const [savedIngredients, setSavedIngredients] = useState<
    RecipeIngredientDetail[]
  >([]);

  const [name, setName] = useState("");
  // weight/weightUnit: entry-convenience state, not persisted directly —
  // weightUnit always resets to 'g' when a baseline (re)loads, since the
  // server only ever stores grams (see docs/pending-deviations.md, Ticket
  // 12 follow-up, "servings -> weight").
  const [weight, setWeight] = useState("0");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("g");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredientDetail[]>([]);

  const [ingredientsLoading, setIngredientsLoading] = useState(true);
  const [ingredientsError, setIngredientsError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  // Read from the last-persisted baseline (not the live draft) — see
  // docs/pending-deviations.md (Ticket 12). `!= null` (not `!== null`) so a
  // pre-migration Dexie row that's missing `updated_by` entirely
  // (`undefined`, not `null` — see useProfileNames) doesn't slip through.
  const profileIds = savedRecipe
    ? [savedRecipe.created_by, savedRecipe.updated_by].filter(
        (id) => id != null,
      )
    : [];
  const profileNames = useProfileNames(profileIds);
  const wasUpdated = savedRecipe?.updated_by != null;

  function applyRecipeBaseline(next: Recipe) {
    setSavedRecipe(next);
    setName(next.name);
    setWeight(next.weight_g.toString());
    setWeightUnit("g");
    setPhotoUrl(next.photo_url);
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
    let cancelled = false;
    setIngredientsLoading(true);
    setIngredientsError(null);
    fetchRecipeIngredients(recipeId)
      .then((rows) => {
        if (cancelled) return;
        setSavedIngredients(rows);
        setIngredients(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setIngredientsError(
          err instanceof Error
            ? err.message
            : "Couldn't load this recipe's ingredients.",
        );
      })
      .finally(() => {
        if (!cancelled) setIngredientsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  const parsedWeight = Number(weight);
  // Always the grams value that would actually be saved, regardless of
  // which unit is currently selected — used for the dirty check, validity,
  // and the live per-gram kcal calculation below. Rounded to the nearest
  // gram — a plain `* 1000` can land on a floating-point artifact (e.g.
  // 1.005 * 1000 === 1004.9999999999999) that would otherwise get stored
  // and displayed as-is, and would also make the dirty-check spuriously
  // true after a save (savedRecipe.weight_g comes back as the same rounded
  // integer the server actually stored).
  const weightG =
    weightUnit === "kg" ? Math.round(parsedWeight * 1000) : parsedWeight;

  // Realtime — recomputed on every keystroke/add/remove from the draft
  // ingredient list, not read from the persisted recipe row. Uses the same
  // formula as the recalculate_recipe_kcal trigger (schema.md), so it
  // matches what the server will compute once saved.
  const totalKcal = useMemo(
    () =>
      ingredients.reduce(
        (sum, item) =>
          sum + kcalPerUnit(item.kcal, item.quantity) * item.quantity_used,
        0,
      ),
    [ingredients],
  );

  const isDirty = useMemo(() => {
    if (!savedRecipe) return false;
    if (name !== savedRecipe.name) return true;
    if (weightG !== savedRecipe.weight_g) return true;
    if (photoUrl !== savedRecipe.photo_url) return true;
    // A newly staged (not yet uploaded) photo doesn't change `photoUrl`
    // itself — the upload only happens at save time — so it needs its own
    // dirty check to enable the Save button.
    if (pendingPhotoFile) return true;
    if (ingredients.length !== savedIngredients.length) return true;
    return ingredients.some((item) => {
      const prev = savedIngredients.find(
        (s) => s.ingredient_id === item.ingredient_id,
      );
      return !prev || prev.quantity_used !== item.quantity_used;
    });
  }, [
    name,
    weightG,
    photoUrl,
    pendingPhotoFile,
    ingredients,
    savedRecipe,
    savedIngredients,
  ]);

  const isValid = name.trim() !== "" && Number.isFinite(weightG) && weightG > 0;

  function handleAddIngredient(ingredient: Ingredient, quantityUsed: number) {
    setIngredients((prev) => [
      ...prev,
      {
        ingredient_id: ingredient.id,
        quantity_used: quantityUsed,
        name: ingredient.name,
        brand: ingredient.brand,
        unit: ingredient.unit,
        kcal: ingredient.kcal,
        quantity: ingredient.quantity,
        is_community: ingredient.is_community,
      },
    ]);
  }

  function handleQuantityChange(ingredientId: string, quantityUsed: number) {
    setIngredients((prev) =>
      prev.map((item) =>
        item.ingredient_id === ingredientId
          ? { ...item, quantity_used: quantityUsed }
          : item,
      ),
    );
  }

  function handleRemoveIngredient(ingredientId: string) {
    setIngredients((prev) =>
      prev.filter((item) => item.ingredient_id !== ingredientId),
    );
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
      const effectivePhotoUrl = pendingPhotoFile
        ? await uploadPhoto(pendingPhotoFile, "recipe", recipeId)
        : photoUrl;

      // Recipe-field-only changes go through Dexie + the outbox — this
      // succeeds offline, same as the Pantry/Log screens.
      const fieldsChanged =
        name !== savedRecipe.name ||
        weightG !== savedRecipe.weight_g ||
        effectivePhotoUrl !== savedRecipe.photo_url;
      if (fieldsChanged) {
        const updated = await updateRecipe(recipeId, userId, {
          name,
          weight_g: weightG,
          photo_url: effectivePhotoUrl,
        });
        applyRecipeBaseline(updated);

        // Removing an existing photo (not just replacing it) also deletes
        // its R2 object, not just the field. Runs after the field update
        // above succeeds, not before — deleting from R2 first and then
        // having the save fail would leave the row still pointing at a
        // now-deleted object. Best-effort: an orphaned object if this
        // fails is the same accepted risk documented elsewhere for this
        // feature (docs/pending-deviations.md, Ticket 15).
        if (savedRecipe.photo_url && !effectivePhotoUrl) {
          try {
            await deletePhoto("recipe", recipeId);
          } catch {
            // Swallowed — see above.
          }
        }
      }
      setPendingPhotoFile(null);

      // Ingredient-line changes require connectivity (see file header).
      // Built as thunks and run sequentially below — NOT fired concurrently
      // (the previous `ops.push(someCall(...))` shape started every call
      // immediately as its own independent request/transaction, then just
      // waited on all of them via Promise.allSettled). Each of these fires
      // the server-side recalculate_recipe_kcal trigger, which recomputes
      // total_kcal from scratch by re-reading every recipe_ingredients row
      // for this recipe at the moment it runs — running them concurrently
      // is a race where whichever transaction commits last wins, but if its
      // own read ran before an earlier op's write had committed, it
      // overwrites the correct combined total with a partial one (e.g.
      // adding two ingredients in one save could leave total_kcal
      // reflecting only one of them, even though both rows exist). See
      // docs/pending-deviations.md (Ticket 12 follow-up, "recipe totals
      // racing on multi-ingredient saves").
      const ops: Array<() => Promise<void>> = [];
      const draftIds = new Set(ingredients.map((i) => i.ingredient_id));
      for (const saved of savedIngredients) {
        if (!draftIds.has(saved.ingredient_id)) {
          ops.push(() => removeRecipeIngredient(recipeId, saved.ingredient_id));
        }
      }
      for (const item of ingredients) {
        const prev = savedIngredients.find(
          (s) => s.ingredient_id === item.ingredient_id,
        );
        if (!prev) {
          ops.push(() =>
            addRecipeIngredient(
              recipeId,
              item.ingredient_id,
              item.quantity_used,
            ),
          );
        } else if (prev.quantity_used !== item.quantity_used) {
          ops.push(() =>
            updateRecipeIngredientQuantity(
              recipeId,
              item.ingredient_id,
              item.quantity_used,
            ),
          );
        }
      }

      if (ops.length > 0) {
        let failedCount = 0;
        for (const op of ops) {
          try {
            await op();
          } catch {
            failedCount += 1;
          }
        }

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

        if (failedCount > 0) {
          throw new Error(
            `${failedCount} of ${ops.length} ingredient change${ops.length === 1 ? "" : "s"} failed to save — this usually means you're offline. Try again once you're back online.`,
          );
        }
      }

      setJustSaved(true);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Failed to save changes. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (recipeLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!savedRecipe) {
    return (
      <Box sx={{ p: 2, maxWidth: 480, mx: "auto" }}>
        <Alert severity="error">Recipe not found.</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, mx: "auto", pb: 4 }}>
      <Box
        sx={{ position: "relative", display: "flex", justifyContent: "center" }}
      >
        <DeferredPhotoUpload
          photoUrl={photoUrl}
          onChange={setPhotoUrl}
          onFileSelected={setPendingPhotoFile}
          alt={name}
          size={200}
        />
        <IconButton
          aria-label="Recipe actions"
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{ position: "absolute", top: 0, right: 0 }}
        >
          <MoreVertIcon />
        </IconButton>
      </Box>

      <ItemMetadata
        creatorName={profileNames[savedRecipe.created_by]}
        createdAt={savedRecipe.created_at}
        updaterName={
          savedRecipe.updated_by
            ? profileNames[savedRecipe.updated_by]
            : undefined
        }
        updatedAt={savedRecipe.updated_at}
        wasUpdated={wasUpdated}
      />

      {/* Stat tiles matching the total/per-serving kcal pattern from
          docs/mocks/recipe-detail-*.png, updated to per-gram (see
          docs/pending-deviations.md, Ticket 12 follow-up). Computed live
          from the draft ingredient list (see totalKcal above) rather than
          read from savedRecipe.total_kcal, so it updates as the user edits,
          before anything is saved. */}
      <Stack direction="row" spacing={1.5}>
        <Paper
          sx={{
            flex: 1,
            p: 1.5,
            textAlign: "center",
            borderRadius: "12px",
            boxShadow: tokens.sh1,
          }}
        >
          <Typography
            sx={{
              fontSize: 18,
              fontWeight: 500,
              color: "primary.main",
            }}
          >
            {totalKcal.toFixed(2)}
          </Typography>
          <Typography
            sx={{
              fontSize: 11,
              color: "text.secondary",
            }}
          >
            total kcal
          </Typography>
        </Paper>
        <Paper
          sx={{
            flex: 1,
            p: 1.5,
            textAlign: "center",
            borderRadius: "12px",
            boxShadow: tokens.sh1,
          }}
        >
          <Typography
            sx={{
              fontSize: 18,
              fontWeight: 500,
              color: "primary.main",
            }}
          >
            {formatKcalPerUnit(totalKcal, weightG)}
          </Typography>
          <Typography
            sx={{
              fontSize: 11,
              color: "text.secondary",
            }}
          >
            kcal per gram
          </Typography>
        </Paper>
      </Stack>

      <Paper sx={{ p: 3, borderRadius: "14px", boxShadow: tokens.sh2 }}>
        <Stack spacing={2.5}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            disabled={saving}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Weight"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
              fullWidth
              disabled={saving}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            />
            <TextField
              label="Unit"
              select
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
              required
              fullWidth
              disabled={saving}
            >
              <MenuItem value="g">g</MenuItem>
              <MenuItem value="kg">kg</MenuItem>
            </TextField>
          </Stack>
        </Stack>
      </Paper>

      <Menu
        anchorEl={menuAnchor}
        open={menuAnchor !== null}
        onClose={() => setMenuAnchor(null)}
      >
        {/* Disabled while dirty — copying always uses the last-persisted
            version (savedRecipe/savedIngredients), so an unsaved edit
            copying silently instead of what's on screen would be
            surprising. See docs/pending-deviations.md (Ticket 14). */}
        <MenuItem
          disabled={isDirty}
          onClick={() => {
            setMenuAnchor(null);
            setCopyOpen(true);
          }}
        >
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" sx={{ color: "text.primary" }} />
          </ListItemIcon>
          <ListItemText>Copy</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDeleteOpen(true);
          }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: "error.main" }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {ingredientsLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
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
        {saving ? "Saving…" : "Save changes"}
      </Button>

      <DeleteRecipeDialog
        open={deleteOpen}
        recipeName={savedRecipe.name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      <CopyRecipeDialog
        open={copyOpen}
        recipeId={savedRecipe.id}
        recipeName={savedRecipe.name}
        groupId={groupId}
        onClose={() => setCopyOpen(false)}
        onCopied={() => {
          setCopyOpen(false);
          setJustCopied(true);
        }}
      />

      <Snackbar
        open={justSaved}
        autoHideDuration={3000}
        onClose={() => setJustSaved(false)}
        message="Recipe saved"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />

      <Snackbar
        open={justCopied}
        autoHideDuration={3000}
        onClose={() => setJustCopied(false)}
        message="Recipe copied"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
}
