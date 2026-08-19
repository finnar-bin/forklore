export interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  height_cm: number | null;
  goal_weight_kg: number | null;
  goal_type: 'lose' | 'gain' | 'maintain' | null;
  created_at: string;
}
