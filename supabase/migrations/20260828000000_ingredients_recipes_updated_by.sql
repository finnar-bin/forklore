-- Ticket 12 follow-up: group-context metadata (who created/last updated an
-- ingredient or recipe) needs to know *who* made the most recent edit, not
-- just *when* (updated_at already existed). schema.md has no updated_by
-- column for either table — see docs/pending-deviations.md (Ticket 12).
--
-- Nullable and left unset at insert time (created_by already answers "who
-- created it" for a brand-new row) — only ever written by updateIngredient/
-- updateRecipe. A null value is the signal that a row has never been edited
-- since creation, distinguishing "show created_at" from "show updated_at"
-- client-side without relying on timestamp coincidence.
alter table public.ingredients add column updated_by uuid references public.profiles(id);
alter table public.recipes add column updated_by uuid references public.profiles(id);

-- recalculate_recipe_kcal (schema.md) already bumps updated_at on every
-- recipe_ingredients change; a recipe edited only by adding/removing/
-- reweighting ingredients (no change to its own name/servings/photo) would
-- otherwise never get an updated_by at all, since that path never calls the
-- client's updateRecipe. auth.uid() is available here (SECURITY INVOKER,
-- the default — this function runs as the requesting user, same as any
-- plain client update, so RLS/JWT context carries through) — this mirrors
-- what updateRecipe sets client-side for its own (non-ingredient) field edits.
create or replace function recalculate_recipe_kcal()
returns trigger as $$
begin
  update public.recipes
  set total_kcal = (
    select coalesce(sum(i.kcal * ri.quantity_used / i.quantity), 0)
    from public.recipe_ingredients ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.recipe_id = coalesce(new.recipe_id, old.recipe_id)
  ),
  updated_at = now(),
  updated_by = auth.uid()
  where id = coalesce(new.recipe_id, old.recipe_id);
  return null;
end;
$$ language plpgsql;
