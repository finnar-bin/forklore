-- recalculate_recipe_kcal recomputes total_kcal from a full sum over
-- recipe_ingredients/ingredients with no row lock on the target recipe.
-- Two near-simultaneous edits to the same recipe's ingredients (e.g. two
-- quantity edits in quick succession, or a local edit racing an incoming
-- sync pull) can each evaluate the sum independently before either writes
-- back, so the second trigger firing can overwrite the first's contribution
-- to total_kcal instead of building on it. Lock the target recipe row before
-- recomputing — same `for update` pattern already used by
-- accept_group_invite for the same class of race.
--
-- Carries forward the updated_by bump added by the
-- ingredients_recipes_updated_by migration — this replaces that version of
-- the function, not the original phase1 one.
create or replace function public.recalculate_recipe_kcal()
returns trigger as $$
begin
  perform 1 from public.recipes where id = coalesce(new.recipe_id, old.recipe_id) for update;

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
