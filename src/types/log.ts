import type { IngredientUnit } from "./ingredient";
import type { MealType } from "./meal";

// Re-exported so existing `import type { MealType } from '../../types/log'`
// call sites don't need to change — the type itself now lives in meal.ts
// alongside profiles' own per-meal kcal target columns, which need it too.
export type { MealType };

export interface LogEntry {
  id: string;
  group_id: string | null;
  // Who this entry counts against (kcal totals, personal history) — not
  // necessarily who wrote it, see created_by below. Renamed from logged_by:
  // that name misled once actor and attribution target could differ (a
  // group member logging an entry on another member's behalf).
  logged_for: string;
  // Who actually created this entry. Equal to logged_for for anything a
  // user logs for themselves; differs only when logged on a fellow group
  // member's behalf (group_id is not null in that case — a personal entry
  // can only ever be logged for yourself, see the insert RLS policy in
  // supabase/migrations/20260910000000_log_entries_logged_for.sql).
  created_by: string;
  // Real (soft) references, not mere breadcrumbs — name/kcal/unit below are
  // re-derived from whichever of these is set whenever the entry is
  // created or its quantity is edited. Go null on `ON DELETE SET NULL` if
  // the source is deleted, at which point name/kcal/quantity/unit become
  // permanently frozen (see EditLogEntryDialog.tsx).
  source_ingredient_id: string | null;
  source_recipe_id: string | null;
  // Refreshed from the current source's name / (kcal-per-unit * quantity)
  // on every create or quantity edit — not a creation-time-only snapshot.
  // See docs/schema.md and supabase/migrations/20260909000000_log_entries_rework.sql.
  name: string;
  kcal: number;
  quantity: number;
  // The source ingredient's own unit, or 'g' for a recipe (recipes are
  // always logged in grams — see docs/pending-deviations.md, Ticket 12
  // follow-up, "servings -> weight").
  unit: IngredientUnit;
  // Optional — which meal this entry was logged under. Null when the user
  // didn't pick one.
  meal_type: MealType | null;
  logged_at: string;
  created_at: string;
  updated_at: string;
}
