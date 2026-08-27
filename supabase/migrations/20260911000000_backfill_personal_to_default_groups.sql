-- Removing "personal" mode (docs/pending-deviations.md, "Remove personal
-- mode" entry) requires group_id to become mandatory on ingredients/
-- recipes/log_entries. This migration must run — and be verified against
-- real data — before the follow-up migration
-- (20260912000000_require_group_membership.sql) adds that constraint,
-- since any still-personal row would otherwise violate it immediately.
--
-- For every user with a personal (group_id is null) row in ingredients
-- (excluding is_community rows, which are an intentionally-kept exception,
-- not "personal"), recipes, or log_entries:
--   - if they belong to no group yet, create one for them (owner) and
--     reassign all of their personal rows into it;
--   - if they already belong to at least one group, reassign into the
--     earliest one they joined, rather than creating a redundant group.
-- This rule was a product decision, not something I could verify against
-- production data myself (org policy: no DB connections from this tool) —
-- see docs/pending-deviations.md for what to double-check before and after
-- running this.
--
-- updated_at is bumped on every reassigned row: the sync engine
-- (src/sync/pull.ts) pulls deltas by updated_at, so a client with these
-- rows already cached locally (group_id = null) needs a fresh updated_at
-- to know to re-pull them on its next sync cycle.
--
-- A user with zero groups and zero rows to reassign is untouched here —
-- they'll be routed through the new mandatory onboarding group step on
-- their next login (useOnboardingGate now checks group membership too),
-- which is the correct outcome and needs no data fix.

do $$
declare
  v_user record;
  v_group_id uuid;
begin
  for v_user in
    select distinct p.id, p.name
    from public.profiles p
    where exists (
      select 1 from public.ingredients i
      where i.created_by = p.id and i.group_id is null and i.is_community = false
    )
    or exists (
      select 1 from public.recipes r
      where r.created_by = p.id and r.group_id is null
    )
    or exists (
      select 1 from public.log_entries l
      where l.logged_for = p.id and l.group_id is null
    )
  loop
    select gm.group_id into v_group_id
    from public.group_members gm
    where gm.user_id = v_user.id
    order by gm.joined_at asc
    limit 1;

    if v_group_id is null then
      insert into public.groups (name, owner_id)
      values (coalesce(nullif(trim(v_user.name), ''), 'My') || '''s Kitchen', v_user.id)
      returning id into v_group_id;

      insert into public.group_members (group_id, user_id, role)
      values (v_group_id, v_user.id, 'owner');
    end if;

    update public.ingredients
    set group_id = v_group_id, updated_at = now()
    where created_by = v_user.id and group_id is null and is_community = false;

    update public.recipes
    set group_id = v_group_id, updated_at = now()
    where created_by = v_user.id and group_id is null;

    update public.log_entries
    set group_id = v_group_id, updated_at = now()
    where logged_for = v_user.id and group_id is null;
  end loop;
end;
$$;
