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
  name: string;
  quantity: number;
  unit: IngredientUnit;
  kcal: number;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}
