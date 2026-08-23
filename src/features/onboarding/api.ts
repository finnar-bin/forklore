import { supabase } from '../../lib/supabase';
import type { ActivityLevel, BiologicalSex, GoalPace, GoalType } from '../../types/profile';

export interface OnboardingInput {
  name: string;
  birthdate: string;
  sex: BiologicalSex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  goalWeightKg: number;
  goalPace: GoalPace | null;
  dailyKcalTarget: number;
}

// Atomic profiles update + weight_logs insert — see the complete_onboarding
// RPC (supabase/migrations/20260824000000_onboarding_profile_and_calorie_target.sql).
export async function completeOnboarding(input: OnboardingInput): Promise<void> {
  const { error } = await supabase.rpc('complete_onboarding', {
    p_name: input.name,
    p_birthdate: input.birthdate,
    p_sex: input.sex,
    p_height_cm: input.heightCm,
    p_weight_kg: input.weightKg,
    p_activity_level: input.activityLevel,
    p_goal_type: input.goalType,
    p_goal_weight_kg: input.goalWeightKg,
    p_goal_pace: input.goalPace,
    p_daily_kcal_target: input.dailyKcalTarget,
  });
  if (error) throw error;
}
