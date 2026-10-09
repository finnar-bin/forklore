import type { Ingredient } from "../../types/ingredient";

// What a search keyword is matched against for an ingredient: its name and
// brand together, so "quaker" or "oats quaker" both find "Rolled Oats ·
// Quaker".
export function ingredientSearchText(
  ingredient: Pick<Ingredient, "name" | "brand">,
): string {
  return ingredient.brand
    ? `${ingredient.name} ${ingredient.brand}`
    : ingredient.name;
}
