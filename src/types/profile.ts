import type { MealType } from './meal';

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
  // Opt-in: when true, community pantry ingredients (see types/ingredient.ts)
  // are usable in this user's personal pantry/recipes/log, alongside their
  // own. See docs/pending-deviations.md ("Community pantry").
  community_pantry_enabled: boolean;
  // Optional per-meal kcal breakdown of daily_kcal_target — the four
  // columns are only meaningful (and only ever written together, summing to
  // daily_kcal_target) when meal_breakdown_enabled is true. Left as-is when
  // the switch is turned back off rather than cleared, so re-enabling it
  // restores the caller's last breakdown instead of starting blank.
  meal_breakdown_enabled: boolean;
  breakfast_kcal_target: number | null;
  lunch_kcal_target: number | null;
  dinner_kcal_target: number | null;
  snack_kcal_target: number | null;
  created_at: string;
}

// Accepts any subset of Profile with these four columns, not just a full
// Profile — features/profiles/api.ts's fetchMemberKcalProfiles fetches only
// this slice (plus id/name/daily_kcal_target/meal_breakdown_enabled) for
// /groups/:groupId/log's per-member breakdown card, and shouldn't need to
// satisfy Profile's full shape just to reuse this mapping.
type MealKcalTargetColumns = Pick<
  Profile,
  'breakfast_kcal_target' | 'lunch_kcal_target' | 'dinner_kcal_target' | 'snack_kcal_target'
>;

export function getMealKcalTargets(profile: MealKcalTargetColumns): Record<MealType, number | null> {
  return {
    breakfast: profile.breakfast_kcal_target,
    lunch: profile.lunch_kcal_target,
    dinner: profile.dinner_kcal_target,
    snack: profile.snack_kcal_target,
  };
}
