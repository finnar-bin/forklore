# Database schema

Living document. Each phase appends new tables/columns under its own section rather than rewriting prior sections. Postgres, hosted on Supabase.

---

## Phase 1

### Extension setup

```sql
create extension if not exists "pgcrypto"; -- for gen_random_uuid()
```

### profiles

Extends Supabase's built-in `auth.users`. One row per user, created automatically on signup via trigger (see below).

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  height_cm numeric,
  goal_weight_kg numeric,
  goal_type text check (goal_type in ('lose', 'gain', 'maintain')),
  created_at timestamptz not null default now()
);
```

**Auto-fill trigger** — populates `name`/`avatar_url` from OAuth metadata (Google SSO) or falls back to the email's local part for email/password signups. `height_cm`, `goal_weight_kg`, `goal_type` are always null after this trigger — no signup method provides body metrics, so onboarding always needs to collect them separately.

```sql
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
```

### weight_logs

Historical weight entries, powers the Progress screen's trend line and BMI-over-time calculation (BMI = weight at a given date vs. `profiles.height_cm`, which rarely changes).

```sql
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  weight_kg numeric not null,
  logged_at date not null default current_date,
  created_at timestamptz not null default now()
);
```

### groups

```sql
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
```

### group_members

```sql
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')) default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
```

Two roles only for Phase 1: `owner` (rename/delete group, manage members — matches `groups.owner_id`) and `member` (full read/write on that group's pantry, recipes, and logs). No granular permission matrix.

### group_invites

Single-use, expiring invite codes. Consumption is atomic via the `accept_group_invite` RPC (see rpcs.md) — never insert into `group_members` directly from the client for an invite flow.

```sql
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
```

### ingredient_unit (enum)

Closed set, not free text — enables reliable AI unit-selection in Phase 2 and prevents unit-drift ("g" vs "grams" vs "gram"). Extend with `alter type ingredient_unit add value 'x'` if a new unit is genuinely needed later.

```sql
create type ingredient_unit as enum (
  'g', 'kg',
  'ml', 'l',
  'tsp', 'tbsp', 'cup',
  'piece', 'slice', 'serving', 'sachet'
);
```

### ingredients

Ownership pattern: **`group_id` nullable** — null means personal (scoped to `created_by`), a value means it belongs to that group. This single-column pattern is used consistently across `ingredients`, `recipes`, and `log_entries` rather than separate personal/group tables.

```sql
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
```

### recipes

Same nullable `group_id` ownership pattern. `total_kcal` is denormalized and recalculated automatically by trigger whenever `recipe_ingredients` changes (see below) — never computed ad hoc in application code. `forked_from_recipe_id` is unused in Phase 1, reserved for Phase 3's community feed forking.

```sql
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
```

### recipe_ingredients

Join table. **`quantity_used` is always expressed in the linked ingredient's own unit** — no cross-unit conversion anywhere in the app. The unit shown in a recipe-building UI next to this quantity must be read-only, inherited from the ingredient, never user-selectable.

```sql
create table public.recipe_ingredients (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity_used numeric not null,
  primary key (recipe_id, ingredient_id)
);
```

### log_entries

**Snapshotted at creation time — never reads live ingredient/recipe data.** `snapshot_name`/`snapshot_kcal`/`snapshot_quantity` are copied in at insert time and are the only fields used for calorie math thereafter. `source_ingredient_id`/`source_recipe_id` are soft breadcrumbs only (for "logged from: X" UI and re-log shortcuts) — they go null on `ON DELETE SET NULL` if the source is deleted, with zero effect on the log entry's own values.

`group_id` follows the same nullable ownership pattern (null = personal log, value = that group's shared log). `logged_by` is always set regardless — it's who actually logged the entry, independent of which log it displays on. This split is what allows a shared group log to exist alongside per-user goal tracking: filter by `group_id` for the group view, by `logged_by` for an individual's own intake history.

```sql
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
```

The `/logs` (all-time, cross-context) view queries `where logged_by = :userId` with no `group_id` filter — it deliberately spans personal and every group the user has logged into. The `/log` and `/groups/:groupId/log` views filter by `group_id` (null or a specific group) instead.

### Triggers

**Recipe kcal recalculation** — fires on any change to `recipe_ingredients`, recomputes the parent recipe's `total_kcal` from scratch. Formula assumes `quantity_used` and the ingredient's own `quantity` share the same unit (guaranteed by the unit-inheritance rule above).

```sql
create or replace function recalculate_recipe_kcal()
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
for each row execute function recalculate_recipe_kcal();
```

### Delete behavior summary

- Deleting an ingredient **cascades** to remove it from any `recipe_ingredients` rows (via `on delete cascade`) — the recalc trigger then updates affected recipes' `total_kcal` automatically. The client is responsible for warning the user before calling delete (see `check_ingredient_usage` RPC in rpcs.md) — the database always performs the cascade regardless of whether a warning was shown.
- Deleting an ingredient or recipe **never affects existing log entries** — `source_ingredient_id`/`source_recipe_id` go null, snapshot fields are untouched.
- Deleting a group cascades to its ingredients, recipes, and log entries (via `on delete cascade` on `group_id`).

### RLS policy pattern

Enable RLS on every table above. The recurring pattern for `ingredients`, `recipes`, and `log_entries` is "personal row owned by the caller, OR caller is a member of the owning group":

```sql
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.log_entries enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

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
```

Apply the same three-policy shape (select/insert/update) to `recipes` and `log_entries`. `recipe_ingredients` policies should check the parent recipe's ownership via a subquery join rather than duplicating the ownership columns.

Groups: only members can read; only the owner can update or delete.

```sql
create policy "members read their groups"
on public.groups for select
using (id in (select group_id from public.group_members where user_id = auth.uid()));

create policy "owner manages group"
on public.groups for update using (owner_id = auth.uid());

create policy "owner deletes group"
on public.groups for delete using (owner_id = auth.uid());
```

### Storage

Photos (ingredient, recipe) are stored in **Cloudflare R2**, not Supabase Storage — a public bucket, no per-object access control (photos are low-sensitivity and become genuinely public in Phase 3's feed anyway, so obscurity via UUID-based paths is sufficient). Path convention: `ingredient-photos/{uuid}.webp`, `recipe-photos/{uuid}.webp`. Store only the resulting URL in `ingredients.photo_url` / `recipes.photo_url` — the schema has no dependency on which provider serves it.

Images are compressed and converted to WebP client-side before upload (max 1024px, ~300KB target) — no server-side processing, no thumbnail variants in Phase 1.
