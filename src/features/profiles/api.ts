import { supabase } from '../../lib/supabase';

// Live Supabase read, not Dexie — `profiles` is declared in Dexie's schema
// (frontend-architecture.md) but nothing has ever pulled into it (no prior
// ticket needed another user's profile). RLS ("select own row or a fellow
// group member's row" — see docs/pending-deviations.md, Ticket 2) is what
// makes this safe to call for a group's ingredient/recipe creators/updaters:
// the caller is necessarily a member of any group whose data they're
// viewing. See docs/pending-deviations.md (Ticket 12).
export async function fetchProfileNames(userIds: string[]): Promise<Record<string, string>> {
  // Filters falsy ids defensively, not just per the `string[]` signature —
  // a caller can pass an id read off a Dexie row that predates a newer
  // optional column (e.g. `updated_by` on a row cached before that column
  // existed locally), which comes back `undefined` at runtime regardless of
  // what the type says. An empty/undefined value reaching Supabase's
  // `.in('id', ...)` filter fails the *entire* query as an invalid uuid,
  // wiping out every id in the batch, not just the bad one — see
  // docs/pending-deviations.md (Ticket 12, "Added by someone" fix).
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase.from('profiles').select('id, name').in('id', uniqueIds);
  if (error) throw error;

  return Object.fromEntries((data ?? []).map((row) => [row.id, row.name]));
}
