import { supabase } from '../../lib/supabase';
import type { Ingredient, IngredientUnit } from '../../types/ingredient';

export interface IngredientInput {
  name: string;
  quantity: number;
  unit: IngredientUnit;
  kcal: number;
  photo_url: string | null;
}

export interface IngredientUsage {
  recipe_id: string;
  recipe_name: string;
}

// Personal pantry only — group_id hardcoded null per this ticket's scope.
// Group-scoped pantry is Ticket 12.
export async function fetchIngredients(userId: string): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .is('group_id', null)
    .eq('created_by', userId)
    .order('name');
  if (error) throw error;
  return data;
}

export async function fetchIngredient(id: string): Promise<Ingredient> {
  const { data, error } = await supabase.from('ingredients').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createIngredient(
  userId: string,
  input: IngredientInput,
): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .insert({ ...input, group_id: null, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// `updated_at` has no update trigger on `ingredients` (only `recipes.updated_at`
// is bumped, by the kcal-recalc trigger) — the client sets it explicitly.
export async function updateIngredient(id: string, input: IngredientInput): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('ingredients').delete().eq('id', id);
  if (error) throw error;
}

// Informs the delete confirmation dialog only — delete always cascades
// regardless of the result (see schema.md "Delete behavior summary").
export async function checkIngredientUsage(id: string): Promise<IngredientUsage[]> {
  const { data, error } = await supabase.rpc('check_ingredient_usage', {
    p_ingredient_id: id,
  });
  if (error) throw error;
  return data;
}
