import type { IngredientUnit } from './ingredient';

export interface LogEntry {
  id: string;
  group_id: string | null;
  logged_by: string;
  source_ingredient_id: string | null;
  source_recipe_id: string | null;
  snapshot_name: string;
  snapshot_kcal: number;
  snapshot_quantity: number | null;
  // The source ingredient's own unit, or 'g' for a recipe (recipes are
  // logged in grams — see docs/pending-deviations.md, Ticket 12 follow-up,
  // "servings -> weight"). Snapshotted at creation time like the other
  // snapshot_* fields — never re-derived from a (possibly since-deleted)
  // source.
  snapshot_unit: IngredientUnit;
  logged_at: string;
  created_at: string;
}
