-- Community pantry.
--
-- Adds a third, opt-in ingredient visibility tier alongside personal/group:
-- a community ingredient (ingredients.is_community) is contributed by any
-- user and readable by everyone, but only its creator may edit or delete it.
-- Reuses the existing ingredients table/RLS shape rather than a parallel
-- table — a community row always has group_id = null, which means the
-- existing "personal row" branch of every insert/update/delete policy
-- already grants exactly "creator-only write" with no policy rewrite there.
-- Only the select policy needs widening (read access, not write). See
-- docs/pending-deviations.md ("Community pantry") for the full writeup.

alter table public.ingredients add column is_community boolean not null default false;
alter table public.ingredients
  add constraint ingredients_community_no_group check (not is_community or group_id is null);

alter table public.profiles add column community_pantry_enabled boolean not null default false;
alter table public.groups add column community_pantry_enabled boolean not null default false;

-- Widen read access only. Insert/update/delete are intentionally untouched —
-- their existing "(group_id is null and created_by = auth.uid())" branch
-- already covers a community row (group_id is always null on one, per the
-- check constraint above), which already means "only the creator may write
-- it," exactly the rule this feature needs.
drop policy "read own or group ingredients" on public.ingredients;
create policy "read own or group ingredients"
on public.ingredients for select
using (
  (group_id is null and created_by = auth.uid())
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
  or is_community = true
);

-- Privileged, count-only usage check for a community ingredient's delete
-- confirmation. check_ingredient_usage (rpcs.md) is a plain `stable`
-- function, not security definer — it only ever sees recipes the caller
-- themselves can already read via RLS. For a community ingredient that may
-- be used by other users' private recipes, that means a creator could see
-- an all-clear warning while deleting it silently breaks recipes they have
-- no visibility into. This function bypasses RLS to return a total count
-- (no recipe names or owners — that would leak other users' recipe
-- existence/content, which check_ingredient_usage's per-caller visibility is
-- correctly guarding against). The client calls both this and the existing
-- check_ingredient_usage for a community ingredient, and shows "used in N of
-- your recipes: X, Y" (named, from the existing function) alongside "used in
-- M recipes total" (this function) — never naming a recipe the caller
-- couldn't already see on their own.
-- Scoped to `is_community = true` explicitly, not just called only for
-- community ingredients client-side (docs/pending-deviations.md's
-- Ticket 14 fix note already establishes the pattern this follows: a
-- security definer function must re-verify its own precondition
-- server-side, never trust the caller to only invoke it in the intended
-- case). Without this check, any authenticated caller could pass an
-- arbitrary ingredient id — including someone else's private personal
-- ingredient, or another group's ingredient they share no relationship
-- with — and learn its cross-user recipe usage count, an information
-- disclosure exactly this table's own RLS (and the non-definer
-- check_ingredient_usage) exists to prevent.
create or replace function public.check_community_ingredient_usage(p_ingredient_id uuid)
returns integer as $$
  select count(*)::integer
  from public.recipe_ingredients ri
  join public.ingredients i on i.id = ri.ingredient_id
  where ri.ingredient_id = p_ingredient_id
    and i.is_community = true;
$$ language sql stable security definer set search_path = public;

-- Widen copy_ingredient's and copy_recipe's source-access check (both
-- security definer, from 20260903000000_copy_ingredient_recipe_rpcs.sql) so
-- copying *from* a community ingredient is allowed for any caller, not just
-- the existing personal-owner-or-group-member cases. Community ingredients
-- are readable by everyone (the select policy above), so this doesn't widen
-- what a caller can already see — it only lets them use copy_ingredient (an
-- explicit, requested capability, not RLS-read) to fork one into their own,
-- independently-editable pantry row.
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
        or is_community = true
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

  -- Recipes themselves have no community tier (only ingredients do) — this
  -- check is unchanged from 20260903000000_copy_ingredient_recipe_rpcs.sql.
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
      -- copy_ingredient itself now covers a community source (see above) —
      -- no separate check needed here.
      v_target_ingredient_id := public.copy_ingredient(v_source.ingredient_id, p_target_group_id);
    end if;

    insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity_used)
    values (v_new_recipe_id, v_target_ingredient_id, v_source.quantity_used);
  end loop;

  return v_new_recipe_id;
end;
$$ language plpgsql security definer set search_path = public;
