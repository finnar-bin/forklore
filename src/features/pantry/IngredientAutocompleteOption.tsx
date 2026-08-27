import type { HTMLAttributes } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { formatKcalPerUnit } from "../../lib/kcal";
import type { Ingredient } from "../../types/ingredient";

// Shared `renderOption` row for every Autocomplete that lets the user pick
// an existing ingredient (AddLogEntryDialog.tsx's cross-context picker,
// AddRecipeIngredientDialog.tsx's "From pantry" step) — name + quantity/unit
// (same size, muted) beside it, an optional second line below, and the
// ingredient's kcal/kcal-per-unit right-aligned, no thumbnail. See
// docs/pending-deviations.md ("Log entry dialog autocomplete options mimic
// RecipeCard/IngredientCard layout").
export function IngredientAutocompleteOption({
  liProps,
  ingredient,
  // "Personal"/the owning group's name/"Community" — resolved by the caller
  // (each picker already has its own reason to know this). The brand half
  // of the second line is composed here, not by the caller, so every
  // consumer of this row gets the same "<group> · <brand>" shape for free —
  // see IngredientKcalHeader.tsx's identical composition.
  groupLabel,
}: {
  liProps: HTMLAttributes<HTMLLIElement>;
  ingredient: Ingredient;
  groupLabel: string;
}) {
  return (
    <Box
      component="li"
      {...liProps}
      sx={{ display: "flex", gap: 1.5, alignItems: "center" }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            gap: 0.5,
            minWidth: 0,
          }}
        >
          <Typography
            fontSize={14}
            fontWeight={500}
            noWrap
            sx={{ minWidth: 0 }}
          >
            {ingredient.name}
          </Typography>
          <Typography
            fontSize={14}
            color="text.secondary"
            sx={{ flexShrink: 0 }}
          >
            {ingredient.quantity} {ingredient.unit}
          </Typography>
        </Box>
        <Typography fontSize={12} color="text.secondary" noWrap>
          {groupLabel}
          {ingredient.brand && ` · ${ingredient.brand}`}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography fontSize={14} fontWeight={500} color="primary.main">
          {ingredient.kcal.toFixed(2)} kcal
        </Typography>
        <Typography fontSize={11} color="text.secondary">
          {formatKcalPerUnit(ingredient.kcal, ingredient.quantity)}/
          {ingredient.unit}
        </Typography>
      </Box>
    </Box>
  );
}
