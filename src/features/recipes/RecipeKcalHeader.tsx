import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { formatKcalPerUnit } from "../../lib/kcal";
import type { Recipe } from "../../types/recipe";

// Recipe counterpart to pantry/IngredientKcalHeader.tsx — same layout,
// shared by any screen that asks "how many grams of this recipe" and wants
// a live kcal preview above the amount input (LogRecipeStep.tsx,
// EditLogEntryDialog.tsx).
export function RecipeKcalHeader({
  recipe,
  groupLabel,
  kcal,
}: {
  recipe: Recipe;
  // The owning group's name — resolved by the caller (recipes have no
  // community tier).
  groupLabel: string;
  // Scaled from the recipe's own kcalPerUnit rate by whatever amount the
  // caller's own input currently holds.
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
            noWrap
            sx={{
              fontSize: 18,
              fontWeight: 500,
              minWidth: 0,
            }}
          >
            {recipe.name}
          </Typography>
          <Typography
            sx={{
              fontSize: 18,
              color: "text.secondary",
              flexShrink: 0,
            }}
          >
            {recipe.weight_g} g
          </Typography>
        </Box>
        <Typography
          noWrap
          sx={{
            fontSize: 13,
            color: "text.secondary",
          }}
        >
          {groupLabel}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography
          sx={{
            fontSize: 20,
            color: "primary.main",
          }}
        >
          <Box component="span" sx={{ fontWeight: 700 }}>
            {kcal.toFixed(2)}
          </Box>{" "}
          <Box component="span" sx={{ fontWeight: 400 }}>
            kcal
          </Box>
        </Typography>
        <Typography
          sx={{
            fontSize: 13,
            color: "text.secondary",
          }}
        >
          {formatKcalPerUnit(recipe.total_kcal, recipe.weight_g)} kcal per g
        </Typography>
      </Box>
    </Box>
  );
}
