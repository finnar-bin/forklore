-- Optional brand field on ingredients (requested directly, no ticket number).
--
-- Nullable, no default: existing rows and every other ownership/RLS/trigger
-- concern on ingredients is untouched by this column — it's a plain display
-- field, not part of any uniqueness/matching rule (find_ingredient_match
-- still matches on name+unit only; two differently-branded ingredients with
-- the same name/unit are still offered as a match, same as before this
-- migration).

alter table public.ingredients add column brand text;

-- copy_ingredient (20260903000000_copy_ingredient_recipe_rpcs.sql, widened
-- again in 20260907000000_community_pantry.sql) explicitly lists the columns
-- it copies rather than using `select *` — brand must be added to that list
-- explicitly too, or a copy would silently drop it.
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

  insert into public.ingredients (group_id, created_by, name, brand, quantity, unit, kcal, photo_url)
  select p_target_group_id, auth.uid(), name, brand, quantity, unit, kcal, photo_url
  from public.ingredients
  where id = p_ingredient_id
  returning id into v_new_id;

  return v_new_id;
end;
$$ language plpgsql security definer set search_path = public;
