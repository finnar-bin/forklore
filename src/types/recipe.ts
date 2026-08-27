import type { IngredientUnit } from "./ingredient";

// Entry-convenience unit for the recipe weight fields (RecipeForm,
// RecipeDetail) — never persisted; weight_g is always converted to grams
// before it reaches the server. See docs/pending-deviations.md (Ticket 12
// follow-up, "servings -> weight").
export type WeightUnit = "g" | "kg";

export interface Recipe {
  id: string;
  group_id: string | null;
  created_by: string;
  // Null until the first edit after creation — see docs/pending-deviations.md
  // (Ticket 12). Distinguishes "never edited" (show created_at/created_by)
  // from "edited" (show updated_at/updated_by) without comparing timestamps.
  updated_by: string | null;
  name: string;
  // Total recipe weight in grams — replaces the old serving count. Always
  // grams; the form's g/kg unit picker only exists for entry convenience,
  // converting kg to g before it ever reaches this field (see
  // docs/pending-deviations.md, Ticket 12 follow-up).
  weight_g: number;
  total_kcal: number;
  photo_url: string | null;
  forked_from_recipe_id: string | null;
  created_at: string;
  updated_at: string;
}

// Join table — quantity_used is always in the linked ingredient's own unit
// (schema.md), never user-selectable independently.
export interface RecipeIngredient {
  recipe_id: string;
  ingredient_id: string;
  quantity_used: number;
}

export interface RecipeInput {
  name: string;
  weight_g: number;
  photo_url: string | null;
}

// Joined display shape for one recipe_ingredients row — inherits unit/kcal/
// quantity from the linked ingredient, never stored independently.
export interface RecipeIngredientDetail {
  ingredient_id: string;
  quantity_used: number;
  name: string;
  brand: string | null;
  unit: IngredientUnit;
  kcal: number;
  quantity: number;
  is_community: boolean;
}
