# Supabase setup (Ticket 2)

This migration was authored and reviewed locally but **not applied or tested against a live project** — do that manually with the steps below.

## 1. Create the project

1. Create a new project at supabase.com (or `supabase projects create` via the CLI if you're logged in).
2. Enable Google as an auth provider under Authentication → Providers (needed by Ticket 3, but easiest to flip on now).

## 2. Link and push the migration

```sh
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This applies `migrations/20260819000000_phase1_schema.sql` in full: all Phase 1 tables, the `ingredient_unit` enum, the `handle_new_user` and `recalculate_recipe_kcal` triggers, and RLS policies on every table.

## 3. Verify

- **Tables/enum:** In the Table Editor, confirm every table from `docs/schema.md` exists with matching columns/types, and `ingredient_unit` has exactly the 11 values listed there.
- **RLS enabled:** Database → Tables → each table should show the RLS badge as "Enabled".
- **Cross-user isolation (manual, two accounts):**
  1. Sign up two users (A and B) via Supabase Auth (email/password is fine for this check).
  2. As A, insert a personal ingredient (`group_id = null`, `created_by = A`).
  3. As B, confirm a `select` on `ingredients` does not return A's row, and an `update`/`delete` attempt against A's row id affects 0 rows.
  4. Create a group as A, add a group ingredient. Confirm B (not a member) cannot read it. Add B as a member via a direct `insert` into `group_members` for this test only, then confirm B can now read/write it.
- Record the result of this check somewhere durable (PR description, ticket comment) — it's the acceptance criterion for this ticket, not something the migration file itself can prove.

## Notes

- Policies beyond what `docs/schema.md` spells out verbatim (profiles, weight_logs, group_invites, group_members, and delete policies on ingredients/recipes/recipe_ingredients) are documented as deviations in `docs/pending-deviations.md` under Ticket 2.
- RPC functions from `docs/rpcs.md` (e.g. `check_ingredient_usage`, `accept_group_invite`) are explicitly out of scope for this ticket — they land with Ticket 11.
