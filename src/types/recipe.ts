export interface Recipe {
  id: string;
  group_id: string | null;
  created_by: string;
  name: string;
  servings: number;
  total_kcal: number;
  photo_url: string | null;
  forked_from_recipe_id: string | null;
  created_at: string;
  updated_at: string;
}
