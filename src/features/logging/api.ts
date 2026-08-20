import { supabase } from '../../lib/supabase';
import type { LogEntry } from '../../types/log';

export interface LogEntryInput {
  source_ingredient_id: string | null;
  source_recipe_id: string | null;
  snapshot_name: string;
  snapshot_kcal: number;
  snapshot_quantity: number | null;
}

// Local (not UTC) calendar date — logged_at is a plain `date` column and
// "today" should mean the user's wall-clock day, not the server's.
export function todayLocalDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Personal log only — group_id hardcoded null per this ticket's scope.
// Group-scoped log (/groups/:groupId/log) is Ticket 12.
export async function fetchTodayLogEntries(userId: string): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('log_entries')
    .select('*')
    .eq('logged_by', userId)
    .eq('logged_at', todayLocalDate())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// /logs (all-time, cross-context): queries by logged_by only, no group_id
// filter, by design — see schema.md/routes.md. This will only surface
// personal entries until groups exist (Ticket 12), but already spans every
// group a future query would add, since there's no group_id filter to widen.
export async function fetchAllLogEntries(userId: string): Promise<LogEntry[]> {
  const { data, error } = await supabase
    .from('log_entries')
    .select('*')
    .eq('logged_by', userId)
    .order('logged_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createLogEntry(userId: string, input: LogEntryInput): Promise<LogEntry> {
  const { data, error } = await supabase
    .from('log_entries')
    .insert({ ...input, group_id: null, logged_by: userId, logged_at: todayLocalDate() })
    .select()
    .single();
  if (error) throw error;
  return data;
}
