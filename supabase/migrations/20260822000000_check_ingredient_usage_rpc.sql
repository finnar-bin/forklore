-- check_ingredient_usage RPC (rpcs.md). Needed by Ticket 6's delete
-- confirmation flow; not yet deployed by any prior migration.

create or replace function public.check_ingredient_usage(p_ingredient_id uuid)
returns table(recipe_id uuid, recipe_name text) as $$
  select r.id, r.name
  from public.recipes r
  join public.recipe_ingredients ri on ri.recipe_id = r.id
  where ri.ingredient_id = p_ingredient_id;
$$ language sql stable;
