import { db } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { deletePhoto } from "../../lib/photoUpload";
import { enqueueMutation } from "../../sync/outbox";
import type { Ingredient, IngredientUnit } from "../../types/ingredient";

export interface IngredientInput {
  name: string;
  brand: string | null;
  quantity: number;
  unit: IngredientUnit;
  kcal: number;
  photo_url: string | null;
}

export interface IngredientUsage {
  recipe_id: string;
  recipe_name: string;
}

// Community pantry ingredients (docs/pending-deviations.md, "Community
// pantry") — global, not owned by a user or group, pulled into Dexie
// unconditionally for every signed-in user (see sync/pull.ts). Used directly
// by the /community-pantry browsing page, and merged into the functions
// below wherever a caller's `includeCommunity` flag says the relevant
// group has opted in.
//
// Filtered in JS rather than via a Dexie `.where('is_community')` index —
// booleans aren't valid IndexedDB key values (only number/date/string/binary/
// array), so an index on a boolean column silently never matches anything.
// Same reason `group_id === null` is filtered in JS below rather than
// queried directly.
export async function fetchCommunityIngredients(): Promise<Ingredient[]> {
  const rows = (await db.ingredients.toArray()).filter((i) => i.is_community);
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// Reads come from Dexie, not Supabase — see frontend-architecture.md
// "Offline sync — outbox pattern". Shows every ingredient belonging to
// `groupId` regardless of who added it, matching "group members see the
// whole group's pantry" (schema.md's RLS policies key group rows off
// `group_id` alone, not `created_by`). See docs/pending-deviations.md
// (Ticket 12, "Remove personal mode").
//
// `includeCommunity` merges in every community ingredient (that group's own
// `community_pantry_enabled` switch, decided by the caller) — see
// docs/pending-deviations.md ("Community pantry").
export async function fetchIngredients(
  groupId: string,
  includeCommunity = false,
): Promise<Ingredient[]> {
  const rows = await db.ingredients.where("group_id").equals(groupId).toArray();
  const community = includeCommunity ? await fetchCommunityIngredients() : [];
  return [...rows, ...community].sort((a, b) => a.name.localeCompare(b.name));
}

// Cross-context read for the log entry dialog (Ticket 12 follow-up, "log
// entry dialog shows every ingredient") — every ingredient belonging to any
// group in `groupIds` (the caller's memberships), combined into one flat,
// name-sorted list rather than the strict one-group-at-a-time split
// fetchIngredients above enforces.
//
// `includeCommunity` — see fetchIngredients above; the caller passes true
// here if *any* of the caller's groups has opted in (docs/pending-deviations.md,
// "Community pantry").
export async function fetchAllIngredients(
  groupIds: string[],
  includeCommunity = false,
): Promise<Ingredient[]> {
  const grouped =
    groupIds.length > 0
      ? await db.ingredients.where("group_id").anyOf(groupIds).toArray()
      : [];
  const community = includeCommunity ? await fetchCommunityIngredients() : [];
  return [...grouped, ...community].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export async function fetchIngredient(
  id: string,
): Promise<Ingredient | undefined> {
  return db.ingredients.get(id);
}

// Writes go to Dexie immediately (optimistic UI), then queue to the outbox
// for Supabase — see frontend-architecture.md "Offline sync — outbox pattern".
//
// `id` is caller-supplied (not generated here) so the create dialogs can
// generate it up front and use the same id to upload a staged photo (at
// form-submit time, before this is ever called) — see
// DeferredPhotoUpload.tsx and CreateIngredientDialog.tsx.
export async function createIngredient(
  id: string,
  userId: string,
  groupId: string | null,
  input: IngredientInput,
  isCommunity = false,
): Promise<Ingredient> {
  const now = new Date().toISOString();
  const ingredient: Ingredient = {
    id,
    // A community ingredient always has group_id null (the DB's own
    // ingredients_group_or_community check constraint enforces this too) —
    // forced here rather than trusted from the caller's groupId argument.
    // A non-community ingredient always has a real groupId (see
    // docs/pending-deviations.md, "Remove personal mode").
    group_id: isCommunity ? null : groupId,
    created_by: userId,
    updated_by: null,
    is_community: isCommunity,
    ...input,
    created_at: now,
    updated_at: now,
  };
  await db.ingredients.add(ingredient);
  await enqueueMutation("ingredients", "insert", { ...ingredient });
  return ingredient;
}

// `updated_at` has no update trigger on `ingredients` (only `recipes.updated_at`
// is bumped, by the kcal-recalc trigger) — the client sets it explicitly.
// `updated_by` is set here too (never at creation — see the Ingredient type's
// own comment) so group-context metadata can tell "never edited" from
// "edited by X" — see docs/pending-deviations.md (Ticket 12).
export async function updateIngredient(
  id: string,
  userId: string,
  input: IngredientInput,
): Promise<Ingredient> {
  const updated_at = new Date().toISOString();
  const updated_by = userId;
  await db.ingredients.update(id, { ...input, updated_at, updated_by });
  const ingredient = await db.ingredients.get(id);
  if (!ingredient) throw new Error("Ingredient not found.");
  await enqueueMutation("ingredients", "update", {
    id,
    ...input,
    updated_at,
    updated_by,
  });
  return ingredient;
}

// Promotes a group ingredient into the community pantry — `group_id` is
// forced to null alongside `is_community: true` in the same write,
// satisfying the `ingredients_group_or_community` check constraint (see
// docs/pending-deviations.md, "Community pantry", "Remove personal mode")
// in one step rather than risking a transient state where only one of the
// two is set.
export async function moveIngredientToCommunity(
  id: string,
  userId: string,
): Promise<Ingredient> {
  const updated_at = new Date().toISOString();
  const updated_by = userId;
  const patch = { group_id: null, is_community: true, updated_at, updated_by };
  await db.ingredients.update(id, patch);
  const ingredient = await db.ingredients.get(id);
  if (!ingredient) throw new Error("Ingredient not found.");
  await enqueueMutation("ingredients", "update", { id, ...patch });
  return ingredient;
}

export async function deleteIngredient(id: string): Promise<void> {
  try {
    // Must run before the row is actually removed below — the Edge
    // Function's ownership check needs the row to still exist to verify
    // the caller could see it. Best-effort: a failure here (offline, a
    // transient Edge Function error) must not block deleting the row
    // itself; a surviving orphaned photo is the same accepted risk the R2
    // upload flow already lives with elsewhere (docs/pending-deviations.md,
    // Ticket 15).
    await deletePhoto("ingredient", id);
  } catch {
    // Swallowed — see above.
  }
  await db.ingredients.delete(id);
  await enqueueMutation("ingredients", "delete", { id });
}

// Informs the delete confirmation dialog only — delete always cascades
// regardless of the result (see schema.md "Delete behavior summary"). Stays
// a live Supabase RPC call, not a Dexie read — recipe_ingredients isn't
// mirrored locally (see docs/pending-deviations.md, Ticket 10), so this
// necessarily requires connectivity; the caller already tolerates it failing
// (falls back to "no known usage" rather than blocking delete).
export async function checkIngredientUsage(
  id: string,
): Promise<IngredientUsage[]> {
  const { data, error } = await supabase.rpc("check_ingredient_usage", {
    p_ingredient_id: id,
  });
  if (error) throw error;
  return data;
}

// Privileged, count-only companion to checkIngredientUsage above, for a
// community ingredient's delete confirmation — check_ingredient_usage only
// ever sees recipes the caller can already read via their own RLS, which
// for a widely-shared community ingredient could under-report real usage in
// other users' private recipes. This never names a recipe the caller
// couldn't already see on their own; the caller combines both counts (see
// DeleteIngredientDialog.tsx). See docs/pending-deviations.md ("Community
// pantry").
export async function checkCommunityIngredientUsage(
  id: string,
): Promise<number> {
  const { data, error } = await supabase.rpc(
    "check_community_ingredient_usage",
    {
      p_ingredient_id: id,
    },
  );
  if (error) throw error;
  return data as number;
}
