import { supabase } from '../../lib/supabase';
import type { Recipe, RecipeInput, RecipeIngredientDetail } from '../../types/recipe';

// Personal recipes only — group_id hardcoded null per this ticket's scope.
// Group-scoped recipes are Ticket 12.
export async function fetchRecipes(userId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .is('group_id', null)
    .eq('created_by', userId)
    .order('name');
  if (error) throw error;
  return data;
}

export async function fetchRecipe(id: string): Promise<Recipe> {
  const { data, error } = await supabase.from('recipes').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createRecipe(userId: string, input: RecipeInput): Promise<Recipe> {
  const { data, error } = await supabase
    .from('recipes')
    .insert({ ...input, group_id: null, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// `updated_at` is only bumped automatically by the kcal-recalc trigger, which
// fires on recipe_ingredients changes, not on plain recipe field edits — the
// client sets it explicitly here, same as ingredients.
export async function updateRecipe(id: string, input: RecipeInput): Promise<Recipe> {
  const { data, error } = await supabase
    .from('recipes')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Cascades to remove this recipe's own recipe_ingredients rows and nulls
// source_recipe_id on any log_entries that were logged from it — existing
// log entries keep their snapshot values untouched (see schema.md).
export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchRecipeIngredients(recipeId: string): Promise<RecipeIngredientDetail[]> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('ingredient_id, quantity_used, ingredients ( name, unit, kcal, quantity )')
    .eq('recipe_id', recipeId);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const ingredient = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
    return {
      ingredient_id: row.ingredient_id,
      quantity_used: row.quantity_used,
      name: ingredient.name,
      unit: ingredient.unit,
      kcal: ingredient.kcal,
      quantity: ingredient.quantity,
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
  const { error } = await supabase
    .from('recipe_ingredients')
    .insert({ recipe_id: recipeId, ingredient_id: ingredientId, quantity_used: quantityUsed });
  if (error) throw error;
}

export async function updateRecipeIngredientQuantity(
  recipeId: string,
  ingredientId: string,
  quantityUsed: number,
): Promise<void> {
  const { error } = await supabase
    .from('recipe_ingredients')
    .update({ quantity_used: quantityUsed })
    .eq('recipe_id', recipeId)
    .eq('ingredient_id', ingredientId);
  if (error) throw error;
}

export async function removeRecipeIngredient(recipeId: string, ingredientId: string): Promise<void> {
  const { error } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('ingredient_id', ingredientId);
  if (error) throw error;
}
