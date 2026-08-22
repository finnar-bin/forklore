-- Ticket 14: Ingredient and recipe copy/fork.
--
-- Deploys copy_ingredient, find_ingredient_match, and copy_recipe (rpcs.md),
-- none of which had been deployed by any prior migration, with corrections
-- found while implementing and during review — see
-- docs/pending-deviations.md (Ticket 14) for the full writeup. In short:
--
--   1. copy_ingredient/copy_recipe are `security definer`, so they bypass
--      RLS entirely on every table they touch — both the insert into the
--      *target* context (rpcs.md's own text is wrong to claim RLS enforces
--      target-group membership there) and, just as importantly, the read of
--      the *source* row. Without an explicit check on both sides, any
--      authenticated caller could pass an arbitrary source id belonging to
--      another user/group they have no relationship to and have it copied
--      into their own context — a cross-tenant data-exfiltration path, not
--      just an authorization gap on the write side. Both functions now
--      check source access (owns it personally, or is_group_member of its
--      group) in addition to the target-group membership check.
--   2. copy_recipe trusted the client-supplied `use_existing_id` in
--      p_ingredient_resolutions with no server-side verification that it
--      actually resolves to a visible, genuinely-matching (same name+unit)
--      ingredient in the target context — find_ingredient_match's whole
--      purpose was being re-derived client-side and never re-checked. A
--      modified client could pass an arbitrary ingredient id, linking the
--      new recipe to it; because recalculate_recipe_kcal (schema.md) then
--      runs with RLS bypassed too, that ingredient's kcal would leak into
--      the new recipe's total_kcal as an observable side channel. Now
--      re-verified server-side (same predicate find_ingredient_match uses)
--      before trusting it; falls back to a fresh copy_ingredient call
--      exactly as if no match had been supplied at all if it doesn't check
--      out.
--   3. copy_recipe's rpcs.md example still selects/inserts a `servings`
--      column — recipes.servings was renamed to weight_g in the Ticket 12
--      follow-up ("servings -> weight"), whose own deviation log flagged
--      this exact gap ("whoever implements copy_recipe will need to update
--      that example to weight_g first"). Uses weight_g here.
--   4. Both functions now raise explicitly if the source row can't be found
--      at all (a bad/deleted id slipping past the access check above with
--      zero rows) rather than silently returning a null id — the client
--      would otherwise treat "nothing happened" as a successful copy.
--   5. find_ingredient_match's kcal/quantity guards a zero quantity (no
--      check constraint exists on ingredients.quantity) so one bad row
--      elsewhere can't make every match lookup that happens to hit it throw
--      for unrelated callers.
--
-- search_path is pinned on both security definer functions, per the
-- issue #34 security-hardening precedent (20260901000000_security_hardening.sql).
-- find_ingredient_match stays a plain (non-security-definer) function, same
-- as rpcs.md specifies — its SELECT is correctly gated by the existing
-- "read own or group ingredients" RLS policy as-is, so it needs neither the
-- access check nor the search_path pin the two security definer functions
-- need.

create or replace function public.copy_ingredient(p_ingredient_id uuid, p_target_group_id uuid)
returns uuid as $$
declare
  v_new_id uuid;
begin
  if p_target_group_id is not null and not public.is_group_member(p_target_group_id) then
    raise exception 'Not a member of the target group';
  end if;

  if not exists (
    select 1 from public.ingredients
    where id = p_ingredient_id
      and (
        (group_id is null and created_by = auth.uid())
        or public.is_group_member(group_id)
      )
  ) then
    raise exception 'Ingredient not found or not accessible';
  end if;

  insert into public.ingredients (group_id, created_by, name, quantity, unit, kcal, photo_url)
  select p_target_group_id, auth.uid(), name, quantity, unit, kcal, photo_url
  from public.ingredients
  where id = p_ingredient_id
  returning id into v_new_id;

  return v_new_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.find_ingredient_match(p_name text, p_unit ingredient_unit, p_target_group_id uuid)
returns table(id uuid, name text, unit ingredient_unit, quantity numeric, kcal numeric, kcal_per_unit numeric) as $$
  select id, name, unit, quantity, kcal,
    case when quantity = 0 then 0 else round(kcal / quantity, 2) end as kcal_per_unit
  from public.ingredients
  where lower(name) = lower(p_name)
    and unit = p_unit
    and (
      (p_target_group_id is null and created_by = auth.uid() and group_id is null)
      or group_id = p_target_group_id
    );
$$ language sql stable;

create or replace function public.copy_recipe(
  p_recipe_id uuid,
  p_target_group_id uuid,
  p_ingredient_resolutions jsonb -- [{ "source_ingredient_id": "...", "use_existing_id": "..." | null }]
)
returns uuid as $$
declare
  v_new_recipe_id uuid;
  v_source record;
  v_target_ingredient_id uuid;
begin
  if p_target_group_id is not null and not public.is_group_member(p_target_group_id) then
    raise exception 'Not a member of the target group';
  end if;

  if not exists (
    select 1 from public.recipes
    where id = p_recipe_id
      and (
        (group_id is null and created_by = auth.uid())
        or public.is_group_member(group_id)
      )
  ) then
    raise exception 'Recipe not found or not accessible';
  end if;

  insert into public.recipes (group_id, created_by, name, weight_g, photo_url, forked_from_recipe_id)
  select p_target_group_id, auth.uid(), name, weight_g, photo_url, id
  from public.recipes where id = p_recipe_id
  returning id into v_new_recipe_id;

  if v_new_recipe_id is null then
    raise exception 'Recipe not found';
  end if;

  for v_source in
    select ri.ingredient_id, ri.quantity_used
    from public.recipe_ingredients ri
    where ri.recipe_id = p_recipe_id
  loop
    select (elem->>'use_existing_id')::uuid into v_target_ingredient_id
    from jsonb_array_elements(p_ingredient_resolutions) elem
    where (elem->>'source_ingredient_id')::uuid = v_source.ingredient_id;

    -- Re-verify server-side rather than trusting the client's own
    -- find_ingredient_match result — see this migration's header (point 2).
    -- Falls through to a fresh copy below exactly as if no match had been
    -- supplied at all when the check fails.
    if v_target_ingredient_id is not null and not exists (
      select 1
      from public.ingredients src
      join public.ingredients tgt on tgt.id = v_target_ingredient_id
      where src.id = v_source.ingredient_id
        and lower(tgt.name) = lower(src.name)
        and tgt.unit = src.unit
        and (
          (p_target_group_id is null and tgt.created_by = auth.uid() and tgt.group_id is null)
          or tgt.group_id = p_target_group_id
        )
    ) then
      v_target_ingredient_id := null;
    end if;

    if v_target_ingredient_id is null then
      v_target_ingredient_id := public.copy_ingredient(v_source.ingredient_id, p_target_group_id);
    end if;

    insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity_used)
    values (v_new_recipe_id, v_target_ingredient_id, v_source.quantity_used);
  end loop;

  return v_new_recipe_id;
end;
$$ language plpgsql security definer set search_path = public;
