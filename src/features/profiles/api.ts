import { supabase } from "../../lib/supabase";
import { invalidateMyProfile } from "./useMyProfile";
import type { Profile } from "../../types/profile";

export interface ProfileInput {
  name: string;
  avatar_url: string | null;
  height_cm: number | null;
  birthdate: string | null;
}

// Live Supabase read/write, not Dexie/outbox — profiles aren't part of the
// sync engine's pull scope (src/sync/pull.ts only covers
// ingredients/recipes/log_entries) and have no client-facing reason to be
// offline-editable, same reasoning already applied to `groups` (see
// docs/pending-deviations.md, Ticket 11). RLS ("update own row only", Ticket
// 2 migration) is what makes this safe — a caller can only ever affect their
// own row.
export async function fetchMyProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(
  userId: string,
  input: Partial<ProfileInput>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(input)
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  // Invalidation lives here, not in the caller — same "unforgettable by
  // construction" reasoning as createGroup/updateGroup/deleteGroup in
  // features/groups/api.ts, so a future direct call site can't silently
  // skip it and leave AppHeader's avatar icon (or this screen) stale.
  invalidateMyProfile();
  return data;
}

// Standalone, immediate-save setter for the personal community pantry
// opt-in — lives on /pantry (PantryList.tsx), not ProfileForm, since there's
// no "Save changes" button on a list screen to batch it with. See
// docs/pending-deviations.md ("Community pantry").
export async function setCommunityPantryEnabled(
  userId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ community_pantry_enabled: enabled })
    .eq("id", userId);
  if (error) throw error;
  invalidateMyProfile();
}

// Live Supabase read, not Dexie — `profiles` is declared in Dexie's schema
// (frontend-architecture.md) but nothing has ever pulled into it (no prior
// ticket needed another user's profile). RLS ("select own row or a fellow
// group member's row" — see docs/pending-deviations.md, Ticket 2) is what
// makes this safe to call for a group's ingredient/recipe creators/updaters:
// the caller is necessarily a member of any group whose data they're
// viewing. See docs/pending-deviations.md (Ticket 12).
export async function fetchProfileNames(
  userIds: string[],
): Promise<Record<string, string>> {
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

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", uniqueIds);
  if (error) throw error;

  return Object.fromEntries((data ?? []).map((row) => [row.id, row.name]));
}

export interface MemberKcalProfile {
  id: string;
  name: string;
  daily_kcal_target: number | null;
  meal_breakdown_enabled: boolean;
  breakfast_kcal_target: number | null;
  lunch_kcal_target: number | null;
  dinner_kcal_target: number | null;
  snack_kcal_target: number | null;
}

// Same "select own row or a fellow group member's row" RLS fetchProfileNames
// already relies on (see that function's own comment) — selects just the
// columns GroupMemberKcalCard needs to show each member's own daily target
// and optional per-meal breakdown on /groups/:groupId/log, not the full row.
export async function fetchMemberKcalProfiles(
  userIds: string[],
): Promise<Record<string, MemberKcalProfile>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, name, daily_kcal_target, meal_breakdown_enabled, breakfast_kcal_target, lunch_kcal_target, dinner_kcal_target, snack_kcal_target",
    )
    .in("id", uniqueIds);
  if (error) throw error;

  return Object.fromEntries(
    (data ?? []).map((row) => [row.id, row as MemberKcalProfile]),
  );
}
