import { useEffect, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { kcalPerUnit } from "../../lib/kcal";
import { IngredientKcalHeader } from "../pantry/IngredientKcalHeader";
import { fetchIngredient } from "../pantry/api";
import { useMemberKcalProfiles } from "../profiles/useMemberKcalProfiles";
import { useProfileNames } from "../profiles/useProfileNames";
import { RecipeKcalHeader } from "../recipes/RecipeKcalHeader";
import { fetchRecipe } from "../recipes/api";
import { deleteLogEntry, updateLogEntry } from "./api";
import { DeleteLogEntryDialog } from "./DeleteLogEntryDialog";
import { MealTypeSelector } from "./MealTypeSelector";
import type { Ingredient } from "../../types/ingredient";
import type { LogEntry, MealType } from "../../types/log";
import type { Recipe } from "../../types/recipe";

// Fast-follow mentioned in Ticket 8: editing (or deleting) an already-logged
// entry. Reworked (docs/pending-deviations.md) from freehand name/kcal
// text fields to a quantity-only edit that re-derives kcal/name/unit live
// from the entry's current source — matching how LogIngredientStep/
// LogRecipeStep compute kcal at creation time, instead of letting a typed
// number drift from whatever the source now says. The whole form locks
// read-only (quantity, meal type, Save all disabled — only Delete still
// works) in two cases where that live re-derivation can't be trusted:
//   - Detached: both source_ingredient_id/source_recipe_id are null (the
//     source was deleted) — nothing left to re-derive from.
//   - Unit mismatch: the source ingredient's own unit has changed since
//     this entry was logged (ingredients are editable — see
//     IngredientDetail.tsx). The entry's stored quantity is a raw number
//     entered under the *old* unit; the app does no cross-unit conversion
//     anywhere (schema.md), so re-deriving kcal from the ingredient's
//     current per-unit rate against that old number would silently
//     reinterpret it under the new unit and produce a wrong kcal value.
// Both cases render the same header + quantity layout as the live case
// (the detached one via a synthetic object built from the entry's own
// frozen values, since IngredientKcalHeader only needs a handful of
// display fields, not a real persisted Ingredient — see that component),
// just disabled, rather than swapping in a different read-only layout.
export function EditLogEntryDialog({
  open,
  entry,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  entry: LogEntry;
  onClose: () => void;
  onSaved: (entry: LogEntry) => void;
  onDeleted: (entryId: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit log entry</DialogTitle>
      {/* Mounted only while open, so its draft state starts fresh (matching
          the source entry) every time it's reopened for a different entry. */}
      {open && (
        <EditLogEntryForm
          entry={entry}
          onClose={onClose}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </Dialog>
  );
}

function EditLogEntryForm({
  entry,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: LogEntry;
  onClose: () => void;
  onSaved: (entry: LogEntry) => void;
  onDeleted: (entryId: string) => void;
}) {
  // undefined = still loading, null = no source (either never had one — not
  // a real case today — or the source has been deleted since).
  const [ingredient, setIngredient] = useState<Ingredient | null | undefined>(
    entry.source_ingredient_id ? undefined : null,
  );
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(
    entry.source_recipe_id ? undefined : null,
  );
  const [quantity, setQuantity] = useState(entry.quantity.toString());
  const [mealType, setMealType] = useState<MealType | null>(entry.meal_type);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (entry.source_ingredient_id) {
      // Falls back to "no source" on a read failure, same as a genuinely
      // missing row — an unreadable source can't be re-derived from
      // either, and without this the dialog would otherwise sit on its
      // loading spinner forever (the promise rejecting left both
      // `ingredient` and `recipe` at their initial `undefined`).
      fetchIngredient(entry.source_ingredient_id)
        .then((row) => setIngredient(row ?? null))
        .catch(() => setIngredient(null));
    }
    if (entry.source_recipe_id) {
      fetchRecipe(entry.source_recipe_id)
        .then((row) => setRecipe(row ?? null))
        .catch(() => setRecipe(null));
    }
  }, [entry.source_ingredient_id, entry.source_recipe_id]);

  const loading = ingredient === undefined || recipe === undefined;
  // Detached: the source this entry was logged from has since been
  // deleted (or, for a pre-rework row with neither id, never had one) —
  // nothing to re-derive kcal/name/unit from, so those fields are frozen.
  const detached = !loading && ingredient === null && recipe === null;
  // Unit mismatch: the ingredient still exists, but its own unit has
  // changed since this entry was logged — the stored quantity is a raw
  // number entered under the old unit (see the file-level comment above),
  // so it can't be safely re-derived either. Recipes have no unit field of
  // their own (always grams) — not reachable via that branch.
  const unitMismatch = ingredient != null && ingredient.unit !== entry.unit;
  const locked = detached || unitMismatch;
  const canEditQuantity = !loading && !locked;

  // Not resolved to the group's actual name (unlike AddLogEntryDialog's own
  // groupLabel helper) — this dialog already knows exactly which entry it's
  // editing, so "Group" is enough context without pulling in useMyGroups
  // just for this header.
  const groupLabel = "Group";

  // Who this entry counts against — always shown (matching LogEntryCard's
  // identical treatment). Display-only: reassigning logged_for after
  // creation isn't supported — see docs/pending-deviations.md.
  const names = useProfileNames([entry.logged_for]);
  const loggedForName = names[entry.logged_for];

  // Whether the entry's own logged_for has meal-type breakdown enabled —
  // same reasoning as AddLogEntryDialog's identical lookup: the selector
  // should reflect whoever this entry actually counts against, which
  // (unlike name/kcal/unit) is fixed at creation and never edited here.
  const loggedForProfiles = useMemberKcalProfiles([entry.logged_for]);
  const mealBreakdownEnabled =
    loggedForProfiles[entry.logged_for]?.meal_breakdown_enabled ?? false;

  const parsedQuantity = Number(quantity);
  // Only checked once the quantity has actually been changed from its
  // last-saved value — otherwise an already-invalid state caused by
  // something *other* than this edit (e.g. a recipe's weight_g shrinking
  // after the fact, leaving the entry's own untouched quantity now over
  // the new max) would block saving unrelated changes, like meal_type,
  // that don't touch quantity at all.
  const quantityChanged = quantity !== entry.quantity.toString();
  const isNegative = quantityChanged && quantity !== "" && parsedQuantity < 0;
  const exceedsWeight =
    quantityChanged &&
    recipe != null &&
    quantity !== "" &&
    parsedQuantity > recipe.weight_g;
  const quantityValid =
    !canEditQuantity ||
    !quantityChanged ||
    (Number.isFinite(parsedQuantity) && parsedQuantity > 0 && !exceedsWeight);
  const isValid = quantityValid && !loading;

  // Frozen at the entry's own last-saved kcal, not re-derived, whenever
  // canEditQuantity is false — covers both detached and unit-mismatch the
  // same way (see the file-level comment above).
  const liveKcal = !canEditQuantity
    ? entry.kcal
    : ingredient
      ? kcalPerUnit(ingredient.kcal, ingredient.quantity) * parsedQuantity
      : recipe
        ? kcalPerUnit(recipe.total_kcal, recipe.weight_g) * parsedQuantity
        : entry.kcal;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // `locked` isn't reflected in `isValid` itself (quantityValid is
    // vacuously true whenever canEditQuantity is false) — the Save button
    // is disabled via a separate `|| locked` check, so guard here too
    // rather than relying solely on that UI-level disable.
    if (!isValid || locked) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await updateLogEntry(entry.id, {
        name: canEditQuantity
          ? (ingredient?.name ?? recipe?.name ?? entry.name)
          : entry.name,
        kcal: canEditQuantity ? liveKcal : entry.kcal,
        quantity: canEditQuantity ? parsedQuantity : entry.quantity,
        unit: canEditQuantity ? (ingredient?.unit ?? entry.unit) : entry.unit,
        meal_type: mealType,
      });
      onSaved(updated);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save changes. Try again.",
      );
      setSaving(false);
    }
  }

  async function handleDelete() {
    await deleteLogEntry(entry.id);
    onDeleted(entry.id);
  }

  return (
    <>
      <DialogContent sx={{ pt: "12px !important" }}>
        <Stack
          spacing={2.5}
          component="form"
          id="edit-log-entry-form"
          onSubmit={handleSubmit}
        >
          {error && <Alert severity="error">{error}</Alert>}

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : ingredient ? (
            <IngredientKcalHeader
              ingredient={ingredient}
              groupLabel={groupLabel}
              kcal={liveKcal}
            />
          ) : recipe ? (
            <RecipeKcalHeader
              recipe={recipe}
              groupLabel={groupLabel}
              kcal={liveKcal}
            />
          ) : (
            // Detached — no real Ingredient/Recipe row to pass, so this
            // reuses IngredientKcalHeader with a synthetic object built
            // from the entry's own frozen values (that header only needs
            // name/quantity/unit/brand/kcal, not a persisted row — see its
            // own Pick<Ingredient, …> prop type). "kcal per {unit}" reads
            // correctly either way: a recipe-sourced entry's unit is
            // always 'g', same as RecipeKcalHeader's hardcoded "per g".
            <IngredientKcalHeader
              ingredient={{
                name: entry.name,
                quantity: entry.quantity,
                unit: entry.unit,
                brand: null,
                kcal: entry.kcal,
              }}
              groupLabel={groupLabel}
              kcal={entry.kcal}
            />
          )}

          <TextField
            label="Quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            fullWidth
            autoFocus
            disabled={saving || !canEditQuantity}
            error={isNegative || exceedsWeight}
            helperText={
              isNegative
                ? "Enter a positive amount."
                : exceedsWeight && recipe
                  ? `Can't exceed this recipe's total weight (${recipe.weight_g}g).`
                  : undefined
            }
            slotProps={{
              htmlInput: recipe
                ? { min: 0, max: recipe.weight_g, step: 1 }
                : { min: 0, step: 0.01 },
              input: {
                endAdornment: (
                  // Always the entry's own frozen unit once locked — not
                  // the ingredient's current one, which is exactly what a
                  // unit mismatch means has drifted from it.
                  <InputAdornment position="end">
                    {canEditQuantity
                      ? (ingredient?.unit ?? entry.unit)
                      : entry.unit}
                  </InputAdornment>
                ),
              },
            }}
          />

          {mealBreakdownEnabled && (
            <MealTypeSelector
              value={mealType}
              onChange={setMealType}
              disabled={saving || locked}
            />
          )}

          {loggedForName && (
            <Typography fontSize={12} color="text.secondary" sx={{ mt: -1.5 }}>
              {loggedForName}
            </Typography>
          )}

          {locked && (
            <Typography fontSize={13} fontWeight={700} color="error.main">
              {detached
                ? "Source deleted — this entry is locked at its last known values."
                : "This ingredient's unit has changed since logging — this entry is locked at its last known values."}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          flexDirection: { xs: "column-reverse", sm: "row" },
          justifyContent: { sm: "space-between" },
          gap: 3,
          px: 3,
          pb: 2,
        }}
      >
        <Button
          color="error"
          variant="outlined"
          onClick={() => setDeleteOpen(true)}
          disabled={saving}
          sx={{ width: { xs: "100%", sm: "auto" } }}
        >
          Delete log entry
        </Button>
        <Stack
          direction="row"
          spacing={1}
          sx={{ width: { xs: "100%", sm: "auto" } }}
        >
          <Button
            onClick={onClose}
            disabled={saving}
            sx={{ flex: { xs: 1, sm: "initial" } }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-log-entry-form"
            variant="contained"
            disabled={!isValid || saving || locked}
            sx={{ flex: { xs: 1, sm: "initial" } }}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </Stack>
      </DialogActions>

      <DeleteLogEntryDialog
        open={deleteOpen}
        entryName={entry.name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
