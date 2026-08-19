-- Phase 1 schema: profiles, weight_logs, groups, group_members, group_invites,
-- ingredient_unit enum, ingredients, recipes, recipe_ingredients, log_entries.
-- Source: docs/schema.md. RPC functions (rpcs.md) are out of scope for this migration.

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ============================================================================
-- Tables
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  height_cm numeric,
  goal_weight_kg numeric,
  goal_type text check (goal_type in ('lose', 'gain', 'maintain')),
  created_at timestamptz not null default now()
);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  weight_kg numeric not null,
  logged_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')) default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create type ingredient_unit as enum (
  'g', 'kg',
  'ml', 'l',
  'tsp', 'tbsp', 'cup',
  'piece', 'slice', 'serving', 'sachet'
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  name text not null,
  quantity numeric not null,
  unit ingredient_unit not null,
  kcal numeric not null,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  name text not null,
  servings integer not null default 1,
  total_kcal numeric not null default 0,
  photo_url text,
  forked_from_recipe_id uuid references public.recipes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity_used numeric not null,
  primary key (recipe_id, ingredient_id)
);

create table public.log_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  logged_by uuid not null references public.profiles(id),
  source_ingredient_id uuid references public.ingredients(id) on delete set null,
  source_recipe_id uuid references public.recipes(id) on delete set null,
  snapshot_name text not null,
  snapshot_kcal numeric not null,
  snapshot_quantity numeric,
  logged_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index idx_log_entries_logged_by_date on public.log_entries (logged_by, logged_at);
create index idx_log_entries_group_date on public.log_entries (group_id, logged_at);

-- ============================================================================
-- Triggers
-- ============================================================================

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
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.recalculate_recipe_kcal()
returns trigger as $$
begin
  update public.recipes
  set total_kcal = (
    select coalesce(sum(i.kcal * ri.quantity_used / i.quantity), 0)
    from public.recipe_ingredients ri
    join public.ingredients i on i.id = ri.ingredient_id
    where ri.recipe_id = coalesce(new.recipe_id, old.recipe_id)
  ),
  updated_at = now()
  where id = coalesce(new.recipe_id, old.recipe_id);
  return null;
end;
$$ language plpgsql;

create trigger trg_recalc_kcal
after insert or update or delete on public.recipe_ingredients
for each row execute function public.recalculate_recipe_kcal();

-- ============================================================================
-- Row level security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.weight_logs enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.log_entries enable row level security;

-- --- profiles ---------------------------------------------------------------
-- Not covered by schema.md's explicit RLS block. See docs/pending-deviations.md
-- (Ticket 2) for the policy choices below.

create policy "read own or group-mate profiles"
on public.profiles for select
using (
  id = auth.uid()
  or id in (
    select gm2.user_id
    from public.group_members gm1
    join public.group_members gm2 on gm2.group_id = gm1.group_id
    where gm1.user_id = auth.uid()
  )
);

create policy "update own profile"
on public.profiles for update
using (id = auth.uid());

-- --- weight_logs -------------------------------------------------------------
-- Not covered by schema.md's explicit RLS block. Personal-only, matches the
-- Progress screen being individual-only (routes.md / phase-1-tickets.md #18).

create policy "read own weight logs"
on public.weight_logs for select
using (user_id = auth.uid());

create policy "write own weight logs"
on public.weight_logs for insert
with check (user_id = auth.uid());

create policy "update own weight logs"
on public.weight_logs for update
using (user_id = auth.uid());

-- --- groups -------------------------------------------------------------
-- select/update/delete are given verbatim in schema.md; insert is not, but is
-- required for group creation to function at all (phase-1-tickets.md #11).

create policy "members read their groups"
on public.groups for select
using (id in (select group_id from public.group_members where user_id = auth.uid()));

create policy "create own group"
on public.groups for insert
with check (owner_id = auth.uid());

create policy "owner manages group"
on public.groups for update using (owner_id = auth.uid());

create policy "owner deletes group"
on public.groups for delete using (owner_id = auth.uid());

-- --- group_members -------------------------------------------------------------
-- Not covered by schema.md's explicit RLS block beyond "enable row level
-- security". Membership rows are otherwise created by the (separately
-- ticketed) group-creation flow and the accept_group_invite RPC, both of
-- which run as security definer and so bypass these policies.

create policy "members read group membership"
on public.group_members for select
using (
  group_id in (select group_id from public.group_members where user_id = auth.uid())
);

create policy "owner removes members"
on public.group_members for delete
using (
  group_id in (select id from public.groups where owner_id = auth.uid())
);

-- --- group_invites -------------------------------------------------------------
-- Not covered by schema.md's explicit RLS block. Acceptance (accepted_by /
-- accepted_at) happens exclusively through the accept_group_invite RPC
-- (security definer, bypasses RLS) per schema.md's note on this table.

create policy "owner reads group invites"
on public.group_invites for select
using (
  group_id in (select id from public.groups where owner_id = auth.uid())
);

create policy "owner creates group invites"
on public.group_invites for insert
with check (
  invited_by = auth.uid()
  and group_id in (select id from public.groups where owner_id = auth.uid())
);

-- --- ingredients -------------------------------------------------------------
-- select/insert/update given verbatim in schema.md. delete is not, but is
-- required by ticket 6 (ingredient CRUD includes delete).

create policy "read own or group ingredients"
on public.ingredients for select
using (
  (group_id is null and created_by = auth.uid())
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
);

create policy "write own or group ingredients"
on public.ingredients for insert
with check (
  (group_id is null and created_by = auth.uid())
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
);

create policy "update own or group ingredients"
on public.ingredients for update
using (
  (group_id is null and created_by = auth.uid())
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
);

create policy "delete own or group ingredients"
on public.ingredients for delete
using (
  (group_id is null and created_by = auth.uid())
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
);

-- --- recipes -------------------------------------------------------------
-- "Apply the same three-policy shape (select/insert/update) to recipes and
-- log_entries" per schema.md.

create policy "read own or group recipes"
on public.recipes for select
using (
  (group_id is null and created_by = auth.uid())
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
);

create policy "write own or group recipes"
on public.recipes for insert
with check (
  (group_id is null and created_by = auth.uid())
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
);

create policy "update own or group recipes"
on public.recipes for update
using (
  (group_id is null and created_by = auth.uid())
  or group_id in (select group_id from public.group_members where user_id = auth.uid())
);

-- --- recipe_ingredients -------------------------------------------------------------
-- "Policies should check the parent recipe's ownership via a subquery join
-- rather than duplicating the ownership columns" per schema.md. select/
-- insert/update covers building a recipe; delete is added to allow removing
-- an ingredient from a recipe (ticket 7).

create policy "read recipe_ingredients via parent recipe"
on public.recipe_ingredients for select
using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id
    and (
      (r.group_id is null and r.created_by = auth.uid())
      or r.group_id in (select group_id from public.group_members where user_id = auth.uid())
    )
  )
);

create policy "write recipe_ingredients via parent recipe"
on public.recipe_ingredients for insert
with check (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id
    and (
      (r.group_id is null and r.created_by = auth.uid())
      or r.group_id in (select group_id from public.group_members where user_id = auth.uid())
    )
  )
);

create policy "update recipe_ingredients via parent recipe"
on public.recipe_ingredients for update
using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id
    and (
      (r.group_id is null and r.created_by = auth.uid())
      or r.group_id in (select group_id from public.group_members where user_id = auth.uid())
    )
  )
);

create policy "delete recipe_ingredients via parent recipe"
on public.recipe_ingredients for delete
using (
  exists (
    select 1 from public.recipes r
    where r.id = recipe_ingredients.recipe_id
    and (
      (r.group_id is null and r.created_by = auth.uid())
      or r.group_id in (select group_id from public.group_members where user_id = auth.uid())
    )
  )
);

-- --- log_entries -------------------------------------------------------------
-- "Apply the same three-policy shape (select/insert/update) to recipes and
-- log_entries" per schema.md.

create policy "read own or group log entries"
on public.log_entries for select
using (
  logged_by = auth.uid()
  or (group_id is not null and group_id in (select group_id from public.group_members where user_id = auth.uid()))
);

create policy "write own or group log entries"
on public.log_entries for insert
with check (
  logged_by = auth.uid()
  and (group_id is null or group_id in (select group_id from public.group_members where user_id = auth.uid()))
);

create policy "update own or group log entries"
on public.log_entries for update
using (
  logged_by = auth.uid()
  or (group_id is not null and group_id in (select group_id from public.group_members where user_id = auth.uid()))
);
