import { supabase } from '../../lib/supabase';
import { invalidateMyProfile } from '../profiles/useMyProfile';
import { WEIGHT_CHART_RANGE_DAYS } from './chartRanges';
import type { GoalPace, GoalType } from '../../types/profile';
import type { WeightLog } from '../../types/weight';

// Trend chart window, not the caller's full history — a multi-year daily
// log would both slow this fetch and cram WeightChart's point-scale x-axis
// past readability. Derived from the widest range the chart's dropdown
// offers, rather than a separately-hardcoded number, so the two can't
// silently drift apart.
const WEIGHT_HISTORY_DAYS = Math.max(...WEIGHT_CHART_RANGE_DAYS);

// Exported for Progress.tsx's client-side range filtering — the chart
// dropdown's shorter windows (7/14/30/60 days) narrow down the same already
// -fetched dataset rather than triggering a new fetch per selection.
export function daysAgoLocalDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Live Supabase read/write, not Dexie/outbox — same reasoning as
// features/profiles/api.ts: weight_logs has no group dimension, isn't part
// of the sync engine's pull scope (src/sync/pull.ts only covers
// ingredients/recipes/log_entries), and RLS ("read/write own rows only",
// phase1_schema.sql) already makes this safe to call directly.
export async function fetchWeightLogs(userId: string): Promise<WeightLog[]> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', daysAgoLocalDate(WEIGHT_HISTORY_DAYS))
    // `logged_at` is a `date` column with no time component — a secondary
    // tiebreaker on `created_at` is required or same-day rows (e.g. the
    // onboarding-seeded entry plus a same-day manual log) come back in a
    // non-deterministic order, corrupting which row Progress.tsx treats as
    // "current weight".
    .order('logged_at', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function logWeight(userId: string, weightKg: number): Promise<WeightLog> {
  const { data, error } = await supabase
    .from('weight_logs')
    .insert({ user_id: userId, weight_kg: weightKg })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export interface GoalInput {
  goalType: GoalType;
  // null for 'maintain' — same "no goal weight for maintain" rule
  // onboarding's GoalStep already enforces.
  goalWeightKg: number | null;
  // Recomputed by EditGoalDialog via the same onboarding/calorieCalc.ts
  // logic CalorieTargetStep already uses — null goalPace matches
  // 'maintain' (no preset pace applies), same mapping complete_onboarding's
  // RPC uses. When the caller's profile is missing an input needed to
  // recompute (sex/activity_level/height_cm/an existing weight log),
  // EditGoalDialog passes the existing values through unchanged rather
  // than clearing them.
  goalPace: GoalPace | null;
  dailyKcalTarget: number | null;
}

// Writes to `profiles`, not `weight_logs` — goal editing is explicitly
// Progress's to own (see features/profiles/Profile.tsx's own comment:
// "Weight/goal editing is explicitly out of scope, owned by Progress").
// Same "update own row only" RLS policy updateMyProfile (features/profiles
// /api.ts) already relies on, so no new policy is needed. Invalidates the
// shared profile cache on success so this screen's own goal display (and
// any other mounted useMyProfile reader) picks up the change immediately.
export async function updateGoal(userId: string, input: GoalInput): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      goal_type: input.goalType,
      goal_weight_kg: input.goalWeightKg,
      goal_pace: input.goalPace,
      daily_kcal_target: input.dailyKcalTarget,
    })
    .eq('id', userId);
  if (error) throw error;
  invalidateMyProfile();
}
