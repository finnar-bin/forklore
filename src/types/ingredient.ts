export type IngredientUnit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'piece'
  | 'slice'
  | 'serving'
  | 'sachet';

// Mirrors the `ingredient_unit` Postgres enum (schema.md) — single source of
// truth for the unit dropdown so it can't drift from the closed enum set.
export const INGREDIENT_UNITS: IngredientUnit[] = [
  'g',
  'kg',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'piece',
  'slice',
  'serving',
  'sachet',
];

export interface Ingredient {
  id: string;
  group_id: string | null;
  created_by: string;
  name: string;
  quantity: number;
  unit: IngredientUnit;
  kcal: number;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}
