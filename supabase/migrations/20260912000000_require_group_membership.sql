-- Removes "personal" (group_id is null) as a valid state for ingredients
-- (except the pre-existing, orthogonal is_community exception), recipes,
-- and log_entries, now that every account is required to belong to at
-- least one group. Must run after
-- 20260911000000_backfill_personal_to_default_groups.sql has been pushed
-- and verified — see docs/pending-deviations.md and supabase/README.md.

-- ============================================================================
-- Column/constraint changes
-- ============================================================================

alter table public.recipes alter column group_id set not null;
alter table public.log_entries alter column group_id set not null;

-- ingredients.group_id stays nullable — it's now only ever null for an
-- is_community row. Replaces the one-directional
-- ingredients_community_no_group check (20260907000000_community_pantry.sql)
-- with the full biconditional this migration establishes as the invariant.
alter table public.ingredients drop constraint ingredients_community_no_group;
alter table public.ingredients
  add constraint ingredients_group_or_community check (
    (is_community and group_id is null) or (not is_community and group_id is not null)
  );

-- ============================================================================
-- RLS: drop the personal branch everywhere it appears
-- ============================================================================

-- --- ingredients -------------------------------------------------------------
-- Personal (non-community) rows can no longer exist. The old personal branch
-- on select/insert/update/delete, "(group_id is null and created_by =
-- auth.uid())", is replaced by an explicit "(is_community and created_by =
-- auth.uid())" branch — community rows are the only remaining group_id-null
-- case, and this keeps the "only its creator may write it" rule from the
-- original community pantry design explicit in the policy itself rather
-- than leaning on the check constraint above to make the old predicate
-- coincidentally safe.

drop policy "read own or group ingredients" on public.ingredients;
create policy "read own or group ingredients"
on public.ingredients for select
using (
  group_id in (select group_id from public.group_members where user_id = auth.uid())
  or is_community = true
);

drop policy "write own or group ingredients" on public.ingredients;
create policy "write own or group ingredients"
on public.ingredients for insert
with check (
  (is_community and created_by = auth.uid())
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
);

drop policy "update own or group ingredients" on public.ingredients;
create policy "update own or group ingredients"
on public.ingredients for update
using (
  (is_community and created_by = auth.uid())
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
);

drop policy "delete own or group ingredients" on public.ingredients;
create policy "delete own or group ingredients"
on public.ingredients for delete
using (
  (is_community and created_by = auth.uid())
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
);

-- --- recipes -------------------------------------------------------------
-- No community tier here — every branch collapses to plain group membership.

drop policy "read own or group recipes" on public.recipes;
create policy "read own or group recipes"
on public.recipes for select
using (group_id in (select group_id from public.group_members where user_id = auth.uid()));

drop policy "write own or group recipes" on public.recipes;
create policy "write own or group recipes"
on public.recipes for insert
with check (group_id in (select group_id from public.group_members where user_id = auth.uid()));

drop policy "update own or group recipes" on public.recipes;
create policy "update own or group recipes"
on public.recipes for update
using (group_id in (select group_id from public.group_members where user_id = auth.uid()));

drop policy "delete own or group recipes" on public.recipes;
create policy "delete own or group recipes"
on public.recipes for delete
using (group_id in (select group_id from public.group_members where user_id = auth.uid()));

-- --- recipe_ingredients -------------------------------------------------------------
-- Ownership is derived from the parent recipe (schema.md) — same personal
-- branch removal, via the same subquery shape.

drop policy "read recipe_ingredients via parent recipe" on public.recipe_ingredients;
create policy "read recipe_ingredients via parent recipe"
on public.recipe_ingredients for select
using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id
    and r.group_id in (select group_id from public.group_members where user_id = auth.uid())
  )
);

drop policy "write recipe_ingredients via parent recipe" on public.recipe_ingredients;
create policy "write recipe_ingredients via parent recipe"
on public.recipe_ingredients for insert
with check (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id
    and r.group_id in (select group_id from public.group_members where user_id = auth.uid())
  )
);

drop policy "update recipe_ingredients via parent recipe" on public.recipe_ingredients;
create policy "update recipe_ingredients via parent recipe"
on public.recipe_ingredients for update
using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id
    and r.group_id in (select group_id from public.group_members where user_id = auth.uid())
  )
);

drop policy "delete recipe_ingredients via parent recipe" on public.recipe_ingredients;
create policy "delete recipe_ingredients via parent recipe"
on public.recipe_ingredients for delete
using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id
    and r.group_id in (select group_id from public.group_members where user_id = auth.uid())
  )
);

-- --- log_entries -------------------------------------------------------------
-- group_id is never null anymore, so every "group_id is null and ... "
-- branch is dead, and every "group_id is not null and ..." guard is always
-- true — both are dropped rather than left as now-vacuous conditions.

drop policy "read own or group log entries" on public.log_entries;
create policy "read own or group log entries"
on public.log_entries for select
using (
  logged_for = auth.uid()
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
);

drop policy "write for self or group member" on public.log_entries;
create policy "write for self or group member"
on public.log_entries for insert
with check (
  created_by = auth.uid()
  and group_id in (select group_id from public.group_members where user_id = auth.uid())
  and group_id in (select group_id from public.group_members where user_id = logged_for)
);

drop policy "update own or group log entries" on public.log_entries;
create policy "update own or group log entries"
on public.log_entries for update
using (group_id in (select group_id from public.group_members where user_id = auth.uid()));

drop policy "delete own or group log entries" on public.log_entries;
create policy "delete own or group log entries"
on public.log_entries for delete
using (group_id in (select group_id from public.group_members where user_id = auth.uid()));

-- ============================================================================
-- RPCs: p_target_group_id / source access, no personal branch left
-- ============================================================================

create or replace function public.copy_ingredient(p_ingredient_id uuid, p_target_group_id uuid)
returns uuid as $$
declare
  v_new_id uuid;
begin
  if p_target_group_id is null then
    raise exception 'Target group is required';
  end if;

  if not public.is_group_member(p_target_group_id) then
    raise exception 'Not a member of the target group';
  end if;

  if not exists (
    select 1 from public.ingredients
    where id = p_ingredient_id
      and (
        public.is_group_member(group_id)
        or is_community = true
      )
  ) then
    raise exception 'Ingredient not found or not accessible';
  end if;

  insert into public.ingredients (group_id, created_by, name, brand, quantity, unit, kcal, photo_url)
  select p_target_group_id, auth.uid(), name, brand, quantity, unit, kcal, photo_url
  from public.ingredients
  where id = p_ingredient_id
  returning id into v_new_id;

  return v_new_id;
end;
$$ language plpgsql security definer set search_path = public;

-- p_target_group_id no longer accepts null ("personal" match target) — a
-- plain (non-security-definer) function, so there's nothing to raise
-- against beyond letting `group_id = p_target_group_id` simply match
-- nothing for a bad/omitted target, same as rpcs.md's original intent for
-- an unmatched lookup.
create or replace function public.find_ingredient_match(p_name text, p_unit ingredient_unit, p_target_group_id uuid)
returns table(id uuid, name text, unit ingredient_unit, quantity numeric, kcal numeric, kcal_per_unit numeric) as $$
  select id, name, unit, quantity, kcal,
    case when quantity = 0 then 0 else round(kcal / quantity, 2) end as kcal_per_unit
  from public.ingredients
  where lower(name) = lower(p_name)
    and unit = p_unit
    and group_id = p_target_group_id;
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
  if p_target_group_id is null then
    raise exception 'Target group is required';
  end if;

  if not public.is_group_member(p_target_group_id) then
    raise exception 'Not a member of the target group';
  end if;

  -- Recipes have no community tier — source access is just group membership.
  if not exists (
    select 1 from public.recipes
    where id = p_recipe_id
      and public.is_group_member(group_id)
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

    if v_target_ingredient_id is not null and not exists (
      select 1
      from public.ingredients src
      join public.ingredients tgt on tgt.id = v_target_ingredient_id
      where src.id = v_source.ingredient_id
        and lower(tgt.name) = lower(src.name)
        and tgt.unit = src.unit
        and tgt.group_id = p_target_group_id
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
