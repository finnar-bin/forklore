export interface Recipe {
  id: string;
  group_id: string | null;
  created_by: string;
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
