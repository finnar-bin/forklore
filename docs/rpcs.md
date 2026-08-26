# RPC functions & Edge Functions

Living document. Covers server-side logic that lives outside plain RLS-gated CRUD — anything needing atomicity across multiple tables, or needing to call an external API.

**Decision rule for where logic goes:**
- Plain ownership-checked reads/writes on a single table → RLS handles it, no function needed.
- Multi-table writes that must succeed or fail together (e.g. forking a recipe and its ingredients) → **Postgres RPC function**, called via `supabase.rpc(...)`. Runs inside the database, transactional by nature, no cold start.
- Anything needing an external HTTP call (AI vision, hidden API keys) → **Supabase Edge Function**. RPC cannot cleanly do this.

---

## Phase 1

### accept_group_invite

Atomically validates and consumes a single-use invite code, adds the caller to the group. The `for update` row lock is what actually enforces single-use — it prevents two simultaneous acceptances of the same code from both succeeding.

```sql
create or replace function accept_group_invite(p_invite_code text)
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
$$ language plpgsql security definer;
```

Called from the `/invite/:inviteCode` route on load/confirm. On success, redirect to `/groups/:groupId/pantry`.

### check_ingredient_usage

Returns which recipes use a given ingredient, so the client can show a specific confirmation dialog ("used in 2 recipes: X, Y — delete anyway?") before calling delete. The delete itself always cascades regardless (see schema.md) — this RPC exists purely to inform the confirmation UI, not to gate the delete.

```sql
create or replace function check_ingredient_usage(p_ingredient_id uuid)
returns table(recipe_id uuid, recipe_name text) as $$
  select r.id, r.name
  from public.recipes r
  join public.recipe_ingredients ri on ri.recipe_id = r.id
  where ri.ingredient_id = p_ingredient_id;
$$ language sql stable;
```

### copy_ingredient

Copies a single ingredient into a different context (personal or another group). Direction-agnostic — the same function handles group→group, group→personal, and personal→group; the only variable is `p_target_group_id` (null for personal). RLS on the underlying insert enforces the caller must be a member of the target group if not personal.

```sql
create or replace function copy_ingredient(p_ingredient_id uuid, p_target_group_id uuid)
returns uuid as $$
declare
  v_new_id uuid;
begin
  insert into public.ingredients (group_id, created_by, name, brand, quantity, unit, kcal, photo_url)
  select p_target_group_id, auth.uid(), name, brand, quantity, unit, kcal, photo_url
  from public.ingredients
  where id = p_ingredient_id
  returning id into v_new_id;

  return v_new_id;
end;
$$ language plpgsql security definer;
```

### find_ingredient_match

Used by the client during a recipe copy to check whether an equivalent ingredient already exists in the target context, before deciding whether to prompt the user or just create a fresh copy. **Only returns candidates where the unit also matches** — a name match with a different unit is not offered as a selectable match at all (accepting it would violate the "quantity_used always in the ingredient's own unit" rule), so the client silently creates a new ingredient copy in that case rather than asking.

```sql
create or replace function find_ingredient_match(p_name text, p_unit ingredient_unit, p_target_group_id uuid)
returns table(id uuid, name text, unit ingredient_unit, quantity numeric, kcal numeric, kcal_per_unit numeric) as $$
  select id, name, unit, quantity, kcal, round(kcal / quantity, 2) as kcal_per_unit
  from public.ingredients
  where lower(name) = lower(p_name)
    and unit = p_unit
    and (
      (p_target_group_id is null and created_by = auth.uid() and group_id is null)
      or group_id = p_target_group_id
    );
$$ language sql stable;
```

**Confirmation UI contract:** when a match is found, compare `kcal_per_unit` on both sides (never raw `kcal` — two correct entries can have different raw values just from being logged at different quantities). If `kcal_per_unit` differs, present two options only: **use existing** (link to it, source's values discarded) or **add as new** (source copied in fresh, both coexist). There is no "overwrite existing" option — silently changing an ingredient's kcal would retroactively affect every other recipe already using it.

### copy_recipe

Deep-copies a recipe and its ingredients into a target context in one transaction. `p_ingredient_resolutions` is a JSON array the client builds after running `find_ingredient_match` per ingredient and collecting the user's confirmations — `use_existing_id` set where the user confirmed a match, `null` where a fresh copy should be created (including all silent-copy cases from unit/name mismatches above).

```sql
create or replace function copy_recipe(
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
  insert into public.recipes (group_id, created_by, name, servings, photo_url, forked_from_recipe_id)
  select p_target_group_id, auth.uid(), name, servings, photo_url, id
  from public.recipes where id = p_recipe_id
  returning id into v_new_recipe_id;

  for v_source in
    select ri.ingredient_id, ri.quantity_used
    from public.recipe_ingredients ri
    where ri.recipe_id = p_recipe_id
  loop
    select (elem->>'use_existing_id')::uuid into v_target_ingredient_id
    from jsonb_array_elements(p_ingredient_resolutions) elem
    where (elem->>'source_ingredient_id')::uuid = v_source.ingredient_id;

    if v_target_ingredient_id is null then
      v_target_ingredient_id := copy_ingredient(v_source.ingredient_id, p_target_group_id);
    end if;

    insert into public.recipe_ingredients (recipe_id, ingredient_id, quantity_used)
    values (v_new_recipe_id, v_target_ingredient_id, v_source.quantity_used);
  end loop;

  return v_new_recipe_id;
end;
$$ language plpgsql security definer;
```

`forked_from_recipe_id` is set on every copy regardless of direction in Phase 1 (not just Phase 3 feed forks) — it's a generally useful breadcrumb ("copied from") and costs nothing to populate now.

### get-upload-url (Edge Function)

Generates an R2 presigned upload URL. Needs to be an Edge Function (not client-side) because generating an R2 presigned URL requires the R2 secret key, which cannot be exposed to the browser.

**Contract:**
- Input: verifies the caller's Supabase JWT (must be authenticated)
- Generates a presigned `PUT` URL scoped to a UUID-based path (`ingredient-photos/{uuid}.webp` or `recipe-photos/{uuid}.webp`)
- Returns the presigned URL to the client, which then `PUT`s the already-compressed WebP file directly to R2

The client compresses/converts to WebP (see schema.md storage section) **before** requesting the upload URL — the Edge Function only ever hands out a URL, it never touches file bytes.
