import { supabase } from '../../lib/supabase';
import type { WeightLog } from '../../types/weight';

// Trend chart window, not the caller's full history — a multi-year daily
// log would both slow this fetch and cram WeightChart's point-scale x-axis
// past readability. 180 days is enough to show a meaningful trend without
// either problem.
const WEIGHT_HISTORY_DAYS = 180;

function daysAgoLocalDate(days: number): string {
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
