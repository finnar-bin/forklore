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
  // Community pantry ingredient — always paired with group_id === null (see
  // the ingredients_community_no_group check constraint). Readable by any
  // authenticated user regardless of anyone's opt-in switch; only created_by
  // may edit/delete it (the existing "personal row" RLS branch already
  // enforces creator-only writes on any group_id-null row). See
  // docs/pending-deviations.md ("Community pantry").
  is_community: boolean;
  created_at: string;
  updated_at: string;
}
