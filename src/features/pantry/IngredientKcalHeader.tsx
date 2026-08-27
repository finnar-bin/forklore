import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { formatKcalPerUnit } from "../../lib/kcal";
import type { Ingredient } from "../../types/ingredient";

// Shared header for any screen that asks "how much of this ingredient" and
// wants a live kcal preview above the quantity input — LogIngredientStep.tsx
// ("quantity eaten"), AddRecipeIngredientDialog.tsx's ExistingIngredientForm
// ("quantity used in this recipe"), and EditLogEntryDialog.tsx (both its
// live-source case and, with a synthetic object built from the entry's own
// frozen fields, its source-deleted case — see that file). Name + the
// ingredient's own quantity/unit (subtle, beside it — same treatment as
// IngredientAutocompleteOption.tsx) on the left, with a group (+ brand)
// subtitle below; the caller's live-computed kcal for whatever quantity is
// currently being typed, plus the ingredient's own kcal-per-unit rate below
// it, on the right.
//
// Takes just the fields it renders (`Pick`, not the full `Ingredient`) so a
// caller with only those values on hand — not an actual persisted
// ingredient — can still use this header.
export function IngredientKcalHeader({
  ingredient,
  groupLabel,
  kcal,
}: {
  ingredient: Pick<Ingredient, "name" | "quantity" | "unit" | "brand" | "kcal">;
  // The owning group's name, or "Community" — resolved by the caller
  // (each screen already has its own reason to know this).
  groupLabel: string;
  // Scaled from the ingredient's own kcalPerUnit rate by whatever quantity
  // the caller's own input currently holds.
  kcal: number;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            gap: 0.5,
            minWidth: 0,
          }}
        >
          <Typography
            fontSize={18}
            fontWeight={500}
            noWrap
            sx={{ minWidth: 0 }}
          >
            {ingredient.name}
          </Typography>
          <Typography
            fontSize={18}
            color="text.secondary"
            sx={{ flexShrink: 0 }}
          >
            {ingredient.quantity} {ingredient.unit}
          </Typography>
        </Box>
        <Typography fontSize={13} color="text.secondary" noWrap>
          {groupLabel}
          {ingredient.brand && ` · ${ingredient.brand}`}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography fontSize={20} color="primary.main">
          <Box component="span" sx={{ fontWeight: 700 }}>
            {kcal.toFixed(2)}
          </Box>{" "}
          <Box component="span" sx={{ fontWeight: 400 }}>
            kcal
          </Box>
        </Typography>
        <Typography fontSize={13} color="text.secondary">
          {formatKcalPerUnit(ingredient.kcal, ingredient.quantity)} kcal per{" "}
          {ingredient.unit}
        </Typography>
      </Box>
    </Box>
  );
}
