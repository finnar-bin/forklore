import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db";
import type { LogEntry } from "../../types/log";

// Deduped/sorted into a stable key, same reasoning as useProfileNames: a
// freshly-mapped array every render would otherwise re-query every render.
function dedupedKey(ids: (string | null)[]): string {
  return Array.from(new Set(ids.filter((id) => id)))
    .sort()
    .join(",");
}

// LogEntry itself has no photo_url column (it only freezes name/kcal/unit —
// see docs/schema.md) — a card's photo, if any, is looked up live off its
// still-existing source ingredient/recipe row instead, keyed by whichever of
// source_ingredient_id/source_recipe_id is set (both null once the source is
// deleted, at which point there's nothing left to look up and the card falls
// back to PhotoThumbnail's placeholder).
//
// Reads Dexie directly (useLiveQuery), not a network fetch like
// useProfileNames — both tables are already synced locally, and this way a
// photo change made elsewhere in the app is picked up without a refetch.
// Returns a getter (rather than the raw id-keyed map) so callers don't each
// have to re-derive the source_ingredient_id/source_recipe_id precedence.
export function useLogEntryPhotos(
  entries: LogEntry[],
): (entry: LogEntry) => string | null | undefined {
  const ingredientKey = dedupedKey(entries.map((e) => e.source_ingredient_id));
  const recipeKey = dedupedKey(entries.map((e) => e.source_recipe_id));

  const photos =
    useLiveQuery(async () => {
      const result: Record<string, string | null> = {};
      if (ingredientKey) {
        const ingredients = await db.ingredients
          .where("id")
          .anyOf(ingredientKey.split(","))
          .toArray();
        for (const ingredient of ingredients) {
          result[ingredient.id] = ingredient.photo_url;
        }
      }
      if (recipeKey) {
        const recipes = await db.recipes
          .where("id")
          .anyOf(recipeKey.split(","))
          .toArray();
        for (const recipe of recipes) {
          result[recipe.id] = recipe.photo_url;
        }
      }
      return result;
    }, [ingredientKey, recipeKey]) ?? {};

  return (entry) => {
    const sourceId = entry.source_ingredient_id ?? entry.source_recipe_id;
    return sourceId ? photos[sourceId] : null;
  };
}
