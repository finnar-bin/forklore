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

export interface Ingredient {
  id: string;
  group_id: string | null;
  created_by: string;
  // Null until the first edit after creation — see docs/pending-deviations.md
  // (Ticket 12). Distinguishes "never edited" (show created_at/created_by)
  // from "edited" (show updated_at/updated_by) without comparing timestamps.
  updated_by: string | null;
  name: string;
  quantity: number;
  unit: IngredientUnit;
  kcal: number;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}
