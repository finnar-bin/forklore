export interface LogEntry {
  id: string;
  group_id: string | null;
  logged_by: string;
  source_ingredient_id: string | null;
  source_recipe_id: string | null;
  snapshot_name: string;
  snapshot_kcal: number;
  snapshot_quantity: number | null;
  logged_at: string;
  created_at: string;
}
