import { db } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { deletePhoto } from "../../lib/photoUpload";
import { enqueueMutation } from "../../sync/outbox";
import type {
  Recipe,
  RecipeInput,
  RecipeIngredientDetail,
} from "../../types/recipe";

// Reads come from Dexie, not Supabase — see frontend-architecture.md
// "Offline sync — outbox pattern". Same personal-vs-group split as
// fetchIngredients (pantry/api.ts) — see docs/pending-deviations.md (Ticket 12).
export async function fetchRecipes(
  userId: string,
  groupId: string | null,
): Promise<Recipe[]> {
  const rows =
    groupId === null
      ? (await db.recipes.where("created_by").equals(userId).toArray()).filter(
          (r) => r.group_id === null,
        )
      : await db.recipes.where("group_id").equals(groupId).toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// Cross-context read for the log entry dialog — see fetchAllIngredients
// (pantry/api.ts) for why this exists alongside the strict fetchRecipes
// above. See docs/pending-deviations.md (Ticket 12 follow-up).
export async function fetchAllRecipes(
  userId: string,
  groupIds: string[],
): Promise<Recipe[]> {
  const personal = (
    await db.recipes.where("created_by").equals(userId).toArray()
  ).filter((r) => r.group_id === null);
  const grouped =
    groupIds.length > 0
      ? await db.recipes.where("group_id").anyOf(groupIds).toArray()
      : [];
  return [...personal, ...grouped].sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchRecipe(id: string): Promise<Recipe | undefined> {
  return db.recipes.get(id);
}

// Writes go to Dexie immediately (optimistic UI), then queue to the outbox
// for Supabase — see frontend-architecture.md "Offline sync — outbox pattern".
//
// `id` is caller-supplied (not generated here) so CreateRecipeDialog can
// generate it up front and use the same id to upload a staged photo (at
// form-submit time, before this is ever called) — see
// DeferredPhotoUpload.tsx.
export async function createRecipe(
  id: string,
  userId: string,
  groupId: string | null,
  input: RecipeInput,
): Promise<Recipe> {
  const now = new Date().toISOString();
  const recipe: Recipe = {
    id,
    group_id: groupId,
    created_by: userId,
    updated_by: null,
    ...input,
    total_kcal: 0,
    forked_from_recipe_id: null,
    created_at: now,
    updated_at: now,
  };
  await db.recipes.add(recipe);
  await enqueueMutation("recipes", "insert", { ...recipe });
  return recipe;
}

// `updated_at` is only bumped automatically by the kcal-recalc trigger, which
// fires on recipe_ingredients changes, not on plain recipe field edits — the
// client sets it explicitly here, same as ingredients. `total_kcal` is left
// untouched (server-computed only — see fetchRecipeIngredients below).
// `updated_by` is set here too — the recalc trigger sets its own copy via
// `auth.uid()` for ingredient-list-only edits that never call this function
// (see docs/pending-deviations.md, Ticket 12), so either edit path keeps it
// current.
export async function updateRecipe(
  id: string,
  userId: string,
  input: RecipeInput,
): Promise<Recipe> {
  const updated_at = new Date().toISOString();
  const updated_by = userId;
  await db.recipes.update(id, { ...input, updated_at, updated_by });
  const recipe = await db.recipes.get(id);
  if (!recipe) throw new Error("Recipe not found.");
  await enqueueMutation("recipes", "update", {
    id,
    ...input,
    updated_at,
    updated_by,
  });
  return recipe;
}

// Cascades to remove this recipe's own recipe_ingredients rows and nulls
// source_recipe_id on any log_entries that were logged from it — existing
// log entries keep their snapshot values untouched (see schema.md).
export async function deleteRecipe(id: string): Promise<void> {
  try {
    // Must run before the row is actually removed below — see
    // deleteIngredient's identical comment (pantry/api.ts).
    await deletePhoto("recipe", id);
  } catch {
    // Swallowed — best-effort, must not block deleting the row itself.
  }
  await db.recipes.delete(id);
  await enqueueMutation("recipes", "delete", { id });
}

// recipe_ingredients (the join table) is not mirrored in Dexie — it has no
// entry in frontend-architecture.md's Dexie schema, and total_kcal is only
// ever correct once recalculated server-side by the recalculate_recipe_kcal
// trigger (schema.md). Offline-queuing edits to this join table would mean
// showing a total_kcal the client can't actually compute correctly until it
// reconnects, so — unlike the recipe's own fields above — these four
// functions stay live Supabase calls and require connectivity. See
// docs/pending-deviations.md (Ticket 10).
export async function fetchRecipeIngredients(
  recipeId: string,
): Promise<RecipeIngredientDetail[]> {
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select(
      "ingredient_id, quantity_used, ingredients ( name, brand, unit, kcal, quantity, is_community )",
    )
    .eq("recipe_id", recipeId);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const ingredient = Array.isArray(row.ingredients)
      ? row.ingredients[0]
      : row.ingredients;
    return {
      ingredient_id: row.ingredient_id,
      quantity_used: row.quantity_used,
      name: ingredient.name,
      brand: ingredient.brand,
      unit: ingredient.unit,
      kcal: ingredient.kcal,
      quantity: ingredient.quantity,
      is_community: ingredient.is_community,
    };
  });
}

// total_kcal is never written here — it's recalculated server-side by the
// recalculate_recipe_kcal trigger. Callers should refetch the parent recipe
// afterward to pick up the new value.
export async function addRecipeIngredient(
  recipeId: string,
  ingredientId: string,
  quantityUsed: number,
): Promise<void> {
  const { error } = await supabase.from("recipe_ingredients").insert({
    recipe_id: recipeId,
    ingredient_id: ingredientId,
    quantity_used: quantityUsed,
  });
  if (error) throw error;
}

export async function updateRecipeIngredientQuantity(
  recipeId: string,
  ingredientId: string,
  quantityUsed: number,
): Promise<void> {
  const { error } = await supabase
    .from("recipe_ingredients")
    .update({ quantity_used: quantityUsed })
    .eq("recipe_id", recipeId)
    .eq("ingredient_id", ingredientId);
  if (error) throw error;
}

export async function removeRecipeIngredient(
  recipeId: string,
  ingredientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId)
    .eq("ingredient_id", ingredientId);
  if (error) throw error;
}

// Reads the recipe straight from Supabase (bypassing Dexie) so callers that
// just made recipe_ingredients changes can pick up the server-recalculated
// total_kcal, then mirrors the fresh row into Dexie so offline/list views
// reflect it too.
export async function refreshRecipeFromServer(id: string): Promise<Recipe> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  await db.recipes.put(data);
  return data;
}
