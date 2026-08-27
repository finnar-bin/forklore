import type { Ingredient } from "../../types/ingredient";
import type { Recipe } from "../../types/recipe";

// "<quantity> <unit> <name>" — e.g. "1 sachet Milo". This is the
// ingredient's own defined quantity/unit, not the amount being logged
// (a separate, user-entered number) — used to identify which ingredient
// a picker option or logging step refers to. Requested directly.
export function formatIngredientLabel(ingredient: Ingredient): string {
  return `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`;
}

// "<weight_g>g <name>" — e.g. "100g Fried Chicken". Same purpose as
// formatIngredientLabel, for recipes.
export function formatRecipeLabel(recipe: Recipe): string {
  return `${recipe.weight_g}g ${recipe.name}`;
}
