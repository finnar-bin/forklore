import { supabase } from "../../lib/supabase";
import { pullScope } from "../../sync/pull";
import type { IngredientUnit } from "../../types/ingredient";

export interface IngredientMatch {
  id: string;
  name: string;
  unit: IngredientUnit;
  quantity: number;
  kcal: number;
  kcal_per_unit: number;
}

export interface IngredientResolution {
  source_ingredient_id: string;
  use_existing_id: string | null;
}

// Copies a single ingredient into a different group's pantry — see
// copy_ingredient in rpcs.md. targetGroupId is always a real group now that
// personal mode is gone (see docs/pending-deviations.md, "Remove personal
// mode") — the RPC itself re-checks and rejects a missing target.
// copy_ingredient/copy_recipe write straight to Supabase, bypassing Dexie and
// the outbox entirely (same as every other RPC call in this codebase, e.g.
// createGroup) — pullScope immediately re-syncs the target context so the
// copy shows up in its pantry/recipes list without waiting for the next
// periodic pull. See docs/pending-deviations.md (Ticket 14).
//
// The RPC has already committed by the time pullScope runs, so a pullScope
// failure (e.g. a transient network blip) is swallowed rather than thrown —
// surfacing it as a failed copy would risk the caller retrying and creating
// a duplicate. The target context just picks the copy up on the next
// periodic pull (useSyncEngine) instead.
export async function copyIngredient(
  ingredientId: string,
  targetGroupId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("copy_ingredient", {
    p_ingredient_id: ingredientId,
    p_target_group_id: targetGroupId,
  });
  if (error) throw error;
  await pullScope({ groupId: targetGroupId }).catch(() => {});
  return data as string;
}

// Finds a genuine match (same name AND same unit) for an ingredient in the
// target context — see find_ingredient_match in rpcs.md. Returns null when
// there's no match, including a name match with a different unit, which is
// never offered as a selectable match at all (rpcs.md's own note).
export async function findIngredientMatch(
  name: string,
  unit: IngredientUnit,
  targetGroupId: string,
): Promise<IngredientMatch | null> {
  const { data, error } = await supabase.rpc("find_ingredient_match", {
    p_name: name,
    p_unit: unit,
    p_target_group_id: targetGroupId,
  });
  if (error) throw error;
  return (data as IngredientMatch[] | null)?.[0] ?? null;
}

// Deep-copies a recipe and its ingredients into a target context in one
// transaction — see copy_recipe in rpcs.md. `resolutions` is built by the
// caller after running findIngredientMatch per ingredient and collecting the
// user's confirmations for genuine matches; a fresh copy is created
// server-side wherever a resolution is missing or has use_existing_id null.
// Same "don't let a post-commit pullScope failure read as a failed copy"
// reasoning as copyIngredient above.
export async function copyRecipe(
  recipeId: string,
  targetGroupId: string,
  resolutions: IngredientResolution[],
): Promise<string> {
  const { data, error } = await supabase.rpc("copy_recipe", {
    p_recipe_id: recipeId,
    p_target_group_id: targetGroupId,
    p_ingredient_resolutions: resolutions,
  });
  if (error) throw error;
  await pullScope({ groupId: targetGroupId }).catch(() => {});
  return data as string;
}
