export type IngredientUnit =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "tsp"
  | "tbsp"
  | "cup"
  | "piece"
  | "slice"
  | "serving"
  | "sachet";

export interface Ingredient {
  id: string;
  // Nullable only for a community ingredient (is_community === true) — every
  // other ingredient belongs to a real group now (see
  // docs/pending-deviations.md, "Remove personal mode").
  group_id: string | null;
  created_by: string;
  // Null until the first edit after creation — see docs/pending-deviations.md
  // (Ticket 12). Distinguishes "never edited" (show created_at/created_by)
  // from "edited" (show updated_at/updated_by) without comparing timestamps.
  updated_by: string | null;
  name: string;
  brand: string | null;
  quantity: number;
  unit: IngredientUnit;
  kcal: number;
  photo_url: string | null;
  // Community pantry ingredient — always paired with group_id === null (see
  // the ingredients_group_or_community check constraint). Readable by any
  // authenticated user regardless of anyone's opt-in switch; only created_by
  // may edit/delete it (an explicit `is_community and created_by = auth.uid()`
  // RLS branch enforces creator-only writes). See docs/pending-deviations.md
  // ("Community pantry", "Remove personal mode").
  is_community: boolean;
  created_at: string;
  updated_at: string;
}
