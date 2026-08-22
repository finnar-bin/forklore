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
// "Offline sync — outbox pattern". `groupId: null` is the personal pantry
// (scoped to the caller via `created_by`, matching the personal RLS policy's
// own shape); a group id shows every ingredient belonging to that group
// regardless of who added it, matching "group members see the whole group's
// pantry" (schema.md's RLS policies key group rows off `group_id` alone, not
// `created_by`). See docs/pending-deviations.md (Ticket 12).
export async function fetchIngredients(userId: string, groupId: string | null): Promise<Ingredient[]> {
  const rows =
    groupId === null
      ? (await db.ingredients.where('created_by').equals(userId).toArray()).filter(
          (i) => i.group_id === null,
        )
      : await db.ingredients.where('group_id').equals(groupId).toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchIngredient(id: string): Promise<Ingredient | undefined> {
  return db.ingredients.get(id);
}

// Writes go to Dexie immediately (optimistic UI), then queue to the outbox
// for Supabase — see frontend-architecture.md "Offline sync — outbox pattern".
export async function createIngredient(
  userId: string,
  groupId: string | null,
  input: IngredientInput,
): Promise<Ingredient> {
  const now = new Date().toISOString();
  const ingredient: Ingredient = {
    id: crypto.randomUUID(),
    group_id: groupId,
    created_by: userId,
    updated_by: null,
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
  if (!ingredient) throw new Error('Ingredient not found.');
  await enqueueMutation('ingredients', 'update', { id, ...input, updated_at, updated_by });
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
