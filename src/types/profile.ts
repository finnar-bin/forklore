export type BiologicalSex = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extremely_active';

export type GoalType = 'lose' | 'gain' | 'maintain';

export type GoalPace = 'steady' | 'aggressive' | 'custom';

export interface Profile {
  id: string;
  name: string;
  avatar_url: string | null;
  birthdate: string | null;
  sex: BiologicalSex | null;
  height_cm: number | null;
  activity_level: ActivityLevel | null;
  goal_weight_kg: number | null;
  goal_type: GoalType | null;
  goal_pace: GoalPace | null;
  daily_kcal_target: number | null;
  created_at: string;
}
