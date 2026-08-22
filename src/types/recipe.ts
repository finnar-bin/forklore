import type { IngredientUnit } from './ingredient';

export interface Recipe {
  id: string;
  group_id: string | null;
  created_by: string;
  // Null until the first edit after creation — see docs/pending-deviations.md
  // (Ticket 12). Distinguishes "never edited" (show created_at/created_by)
  // from "edited" (show updated_at/updated_by) without comparing timestamps.
  updated_by: string | null;
  name: string;
  servings: number;
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
  servings: number;
  photo_url: string | null;
}

// Joined display shape for one recipe_ingredients row — inherits unit/kcal/
// quantity from the linked ingredient, never stored independently.
export interface RecipeIngredientDetail {
  ingredient_id: string;
  quantity_used: number;
  name: string;
  unit: IngredientUnit;
  kcal: number;
  quantity: number;
}
