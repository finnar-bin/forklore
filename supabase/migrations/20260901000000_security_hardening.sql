-- Security hardening from the issue #34 repo audit:
--   1. Pin `search_path` on every SECURITY DEFINER function. None of them do
--      today — flagged by Postgres/Supabase's own linter for this function
--      type, since an unpinned search_path lets a caller who can create
--      objects in a schema earlier in their own search_path shadow what the
--      function resolves (e.g. a same-named function/table). Mitigated in
--      practice today by every reference already being schema-qualified
--      (`public.foo`), but pinning it is a one-line, zero-behavior-change
--      hardening. Each function below is re-declared with an identical body
--      — only `set search_path = public` is added.
--   2. Group invite codes: `substr(md5(random()::text), 1, 8)` is ~32 bits of
--      entropy from a non-cryptographic RNG. pgcrypto is already enabled
--      (see the phase1 schema migration) — gen_random_bytes is a real CSPRNG.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.is_group_member(p_group_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$ language sql security definer stable set search_path = public;

create or replace function public.shares_group_with(p_user_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.group_members gm1
    join public.group_members gm2 on gm2.group_id = gm1.group_id
    where gm1.user_id = auth.uid() and gm2.user_id = p_user_id
  );
$$ language sql security definer stable set search_path = public;

create or replace function public.create_group(p_name text, p_description text)
returns public.groups as $$
declare
  v_group public.groups;
begin
  insert into public.groups (name, description, owner_id)
  values (p_name, p_description, auth.uid())
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'owner');

  return v_group;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.accept_group_invite(p_invite_code text)
returns uuid as $$
declare
  v_invite record;
begin
  select * into v_invite from public.group_invites
  where invite_code = p_invite_code
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_invite.group_id, auth.uid(), 'member');

  update public.group_invites
  set accepted_by = auth.uid(), accepted_at = now()
  where id = v_invite.id;

  return v_invite.group_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.preview_group_invite(p_invite_code text)
returns table(group_id uuid, group_name text) as $$
  select g.id, g.name
  from public.group_invites gi
  join public.groups g on g.id = gi.group_id
  where gi.invite_code = p_invite_code
    and gi.accepted_at is null
    and gi.expires_at > now();
$$ language sql stable security definer set search_path = public;

-- Current signature (10 args, since the onboarding-profile-and-calorie-target
-- migration) — the earlier 5-arg version was already dropped by that
-- migration, so no drop needed here.
create or replace function public.complete_onboarding(
  p_name text,
  p_birthdate date,
  p_sex biological_sex,
  p_height_cm numeric,
  p_weight_kg numeric,
  p_activity_level activity_level,
  p_goal_type goal_type,
  p_goal_weight_kg numeric,
  p_goal_pace goal_pace,
  p_daily_kcal_target numeric
)
returns void as $$
begin
  update public.profiles
  set name = p_name,
      birthdate = p_birthdate,
      sex = p_sex,
      height_cm = p_height_cm,
      activity_level = p_activity_level,
      goal_weight_kg = p_goal_weight_kg,
      goal_type = p_goal_type,
      goal_pace = p_goal_pace,
      daily_kcal_target = p_daily_kcal_target
  where id = auth.uid();

  insert into public.weight_logs (user_id, weight_kg)
  values (auth.uid(), p_weight_kg);
end;
$$ language plpgsql security definer set search_path = public;

-- check_ingredient_usage is intentionally excluded — it has no `security
-- definer` clause, so it already runs with the caller's own privileges and
-- isn't subject to this search_path concern.

alter table public.group_invites
  alter column invite_code set default encode(gen_random_bytes(6), 'hex');
