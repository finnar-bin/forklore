import { db } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { enqueueMutation } from '../../sync/outbox';
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

// Reads come from Dexie, not Supabase — see frontend-architecture.md
// "Offline sync — outbox pattern". Personal pantry only — group_id
// hardcoded null per this ticket's scope. Group-scoped pantry is Ticket 12.
export async function fetchIngredients(userId: string): Promise<Ingredient[]> {
  const rows = await db.ingredients.where('created_by').equals(userId).toArray();
  return rows.filter((i) => i.group_id === null).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchIngredient(id: string): Promise<Ingredient | undefined> {
  return db.ingredients.get(id);
}

// Writes go to Dexie immediately (optimistic UI), then queue to the outbox
// for Supabase — see frontend-architecture.md "Offline sync — outbox pattern".
export async function createIngredient(
  userId: string,
  input: IngredientInput,
): Promise<Ingredient> {
  const now = new Date().toISOString();
  const ingredient: Ingredient = {
    id: crypto.randomUUID(),
    group_id: null,
    created_by: userId,
    ...input,
    created_at: now,
    updated_at: now,
  };
  await db.ingredients.add(ingredient);
  await enqueueMutation('ingredients', 'insert', { ...ingredient });
  return ingredient;
}

// `updated_at` has no update trigger on `ingredients` (only `recipes.updated_at`
// is bumped, by the kcal-recalc trigger) — the client sets it explicitly.
export async function updateIngredient(id: string, input: IngredientInput): Promise<Ingredient> {
  const updated_at = new Date().toISOString();
  await db.ingredients.update(id, { ...input, updated_at });
  const ingredient = await db.ingredients.get(id);
  if (!ingredient) throw new Error('Ingredient not found.');
  await enqueueMutation('ingredients', 'update', { id, ...input, updated_at });
  return ingredient;
}

export async function deleteIngredient(id: string): Promise<void> {
  await db.ingredients.delete(id);
  await enqueueMutation('ingredients', 'delete', { id });
}

// Informs the delete confirmation dialog only — delete always cascades
// regardless of the result (see schema.md "Delete behavior summary"). Stays
// a live Supabase RPC call, not a Dexie read — recipe_ingredients isn't
// mirrored locally (see docs/pending-deviations.md, Ticket 10), so this
// necessarily requires connectivity; the caller already tolerates it failing
// (falls back to "no known usage" rather than blocking delete).
export async function checkIngredientUsage(id: string): Promise<IngredientUsage[]> {
  const { data, error } = await supabase.rpc('check_ingredient_usage', {
    p_ingredient_id: id,
  });
  if (error) throw error;
  return data;
}
