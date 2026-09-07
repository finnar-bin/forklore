-- recalculate_recipe_kcal only triggers on recipe_ingredients changes, so
-- editing an ingredient's own kcal/quantity/unit never recomputes total_kcal
-- on recipes using it. This fans out to every recipe_id referencing the
-- changed ingredient (a single ingredient can appear in many recipes, unlike
-- recipe_ingredients' NEW/OLD.recipe_id), and only fires on kcal/quantity/
-- unit changes via `when`. security definer + pinned search_path (matching
-- accept_group_invite/copy_recipe) because a shared is_community ingredient
-- can be used by recipes in groups the editor isn't a member of — under
-- SECURITY INVOKER those cross-group updates would be silently filtered to
-- 0 rows by recipes' RLS policy. `order by 1` keeps lock order deterministic
-- across concurrent invocations to avoid deadlocks.
create or replace function public.recalculate_recipe_kcal_on_ingredient_change()
returns trigger as $$
declare
  affected_recipe_id uuid;
begin
  for affected_recipe_id in
    select distinct ri.recipe_id
    from public.recipe_ingredients ri
    where ri.ingredient_id = new.id
    order by 1
  loop
    perform 1 from public.recipes where id = affected_recipe_id for update;

    update public.recipes
    set total_kcal = (
      select coalesce(sum(i.kcal * ri.quantity_used / i.quantity), 0)
      from public.recipe_ingredients ri
      join public.ingredients i on i.id = ri.ingredient_id
      where ri.recipe_id = affected_recipe_id
    ),
    updated_at = now(),
    updated_by = auth.uid()
    where id = affected_recipe_id;
  end loop;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_recalc_kcal_on_ingredient_change
after update on public.ingredients
for each row
when (new.kcal is distinct from old.kcal
  or new.quantity is distinct from old.quantity
  or new.unit is distinct from old.unit)
execute function public.recalculate_recipe_kcal_on_ingredient_change();
