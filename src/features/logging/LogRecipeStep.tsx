import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { kcalPerUnit } from "../../lib/kcal";
import { RecipeKcalHeader } from "../recipes/RecipeKcalHeader";
import type { Recipe } from "../../types/recipe";
import type { MealType } from "../../types/log";
import type { LogEntryInput } from "./api";
import { LoggedForSelector } from "./LoggedForSelector";
import { MealTypeSelector } from "./MealTypeSelector";

// Asks how many grams of this recipe were eaten, then computes kcal scaled
// from that — mirrors the quantity-scaling pattern already established for
// recipe_ingredients (kcal * quantity / base quantity) rather than always
// logging the recipe's full total_kcal as one entry. See
// docs/pending-deviations.md (Ticket 8) for why this was chosen over a
// literal one-tap "log the whole recipe" reading of the ticket's wording,
// and (Ticket 12 follow-up, "servings -> weight") for why this asks for
// grams eaten rather than servings eaten.
export function LogRecipeStep({
  recipe,
  groupLabel,
  loggedFor,
  onLoggedForChange,
  loggedForGroupId,
  mealBreakdownEnabled,
  onLog,
  onCancel,
}: {
  recipe: Recipe;
  // Resolved by the caller (AddLogEntryDialog's own groupLabel helper) —
  // the owning group's name (recipes have no community tier).
  groupLabel: string;
  // Who this entry will count against — only rendered as a picker
  // (LoggedForSelector) when `loggedForGroupId` is set.
  loggedFor: string;
  onLoggedForChange: (userId: string) => void;
  // The group this entry will actually land on, resolved by the caller
  // (AddLogEntryDialog's own resolveGroupId) — always just `recipe.group_id`
  // in practice (recipes have no community tier to override it), but taken
  // as an explicit prop so this component doesn't need its own copy of
  // that resolution logic. See LogIngredientStep's identical prop.
  loggedForGroupId: string | null;
  // Whether `loggedFor`'s own profile has meal-type breakdown enabled — see
  // LogIngredientStep's identical prop.
  mealBreakdownEnabled: boolean;
  onLog: (input: LogEntryInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [gramsEaten, setGramsEaten] = useState("");
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedGramsEaten = Number(gramsEaten);
  // Only flagged once something's actually been typed — an empty field
  // isn't "negative" or "over the limit," it's just not filled in yet
  // (canLog below already keeps the button disabled either way).
  const isNegative = gramsEaten !== "" && parsedGramsEaten < 0;
  const exceedsWeight = gramsEaten !== "" && parsedGramsEaten > recipe.weight_g;
  const canLog =
    Number.isFinite(parsedGramsEaten) &&
    parsedGramsEaten > 0 &&
    parsedGramsEaten <= recipe.weight_g;
  const kcal =
    kcalPerUnit(recipe.total_kcal, recipe.weight_g) * parsedGramsEaten;

  async function handleLog() {
    if (!canLog) return;
    setSubmitting(true);
    setError(null);
    try {
      await onLog({
        source_ingredient_id: null,
        source_recipe_id: recipe.id,
        name: recipe.name,
        kcal,
        quantity: parsedGramsEaten,
        // Recipes are always logged in grams — see Ticket 12's
        // servings -> weight change (docs/pending-deviations.md).
        unit: "g",
        meal_type: mealType,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to log this recipe.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogContent sx={{ pt: "12px !important" }}>
        <Stack spacing={2.5}>
          <RecipeKcalHeader
            recipe={recipe}
            groupLabel={groupLabel}
            kcal={kcal}
          />
          <TextField
            label="Amount eaten"
            type="number"
            value={gramsEaten}
            onChange={(e) => setGramsEaten(e.target.value)}
            required
            fullWidth
            autoFocus
            disabled={submitting}
            error={isNegative || exceedsWeight}
            helperText={
              isNegative
                ? "Enter a positive amount."
                : exceedsWeight
                  ? `Can't exceed this recipe's total weight (${recipe.weight_g}g).`
                  : undefined
            }
            slotProps={{
              htmlInput: { min: 0, max: recipe.weight_g, step: 1 },
              input: {
                endAdornment: <InputAdornment position="end">g</InputAdornment>,
              },
            }}
          />
          {loggedForGroupId && (
            <LoggedForSelector
              groupId={loggedForGroupId}
              value={loggedFor}
              onChange={onLoggedForChange}
              disabled={submitting}
            />
          )}
          {mealBreakdownEnabled && (
            <MealTypeSelector
              value={mealType}
              onChange={setMealType}
              disabled={submitting}
            />
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleLog}
          disabled={!canLog || submitting}
        >
          {submitting ? "Logging…" : "Log this recipe"}
        </Button>
      </DialogActions>
    </>
  );
}
