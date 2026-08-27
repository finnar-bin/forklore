import type { IngredientUnit } from "../../types/ingredient";

// Mirrors the `ingredient_unit` Postgres enum (schema.md) — single source of
// truth for the unit dropdown so it can't drift from the closed enum set.
export const INGREDIENT_UNITS: IngredientUnit[] = [
  "g",
  "kg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "piece",
  "slice",
  "serving",
  "sachet",
];
