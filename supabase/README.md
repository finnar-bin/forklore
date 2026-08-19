# Supabase setup (Ticket 2)

This migration was authored and reviewed locally but **not applied or tested against a live project** — do that manually with the steps below.

## 1. Create the project

1. Create a new project at supabase.com (or `supabase projects create` via the CLI if you're logged in).
2. Enable Google as an auth provider under Authentication → Providers (needed by Ticket 3, but easiest to flip on now).

## 2. Configure environments

Copy the templates and fill in real values for each Supabase project (repeat once for dev, once for prod — they're separate projects with separate credentials):

```sh
cp .env.dev.example .env.dev
cp .env.prod.example .env.prod
```

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — from the project's Settings → API page. Read by the frontend app at runtime (`npm run dev`, `npm run build` / `build:dev` pick the matching file via Vite's `--mode`).
- `SUPABASE_PROJECT_REF` — the project ref from the same Settings → API page (or the project's URL slug).
- `SUPABASE_ACCESS_TOKEN` — a personal access token from supabase.com/dashboard/account/tokens, used by the Supabase CLI in place of an interactive `supabase login`.

Both `.env.dev` and `.env.prod` are gitignored — never commit them.

## 3. Push the migration

```sh
npm run supabase:push:dev   # links to the dev project and runs `supabase db push`
npm run supabase:push:prod  # same, against the prod project
```

This runs `scripts/supabase-push.sh`, which reads `SUPABASE_PROJECT_REF`/`SUPABASE_ACCESS_TOKEN` from the matching `.env.<env>` file, runs `supabase link --project-ref`, then `supabase db push`. It applies `migrations/20260819000000_phase1_schema.sql` in full: all Phase 1 tables, the `ingredient_unit` enum, the `handle_new_user` and `recalculate_recipe_kcal` triggers, and RLS policies on every table.

## 4. Verify

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

## Ticket 3 manual verification (auth + `handle_new_user`)

Same database-connection restriction as above applies — this needs a human running the app against a live project with Google OAuth configured.

1. In the Supabase dashboard, under Authentication → Providers, enable Google and fill in the OAuth client ID/secret (a project/domain of your own — see Google Cloud Console). Ticket 2 flagged enabling the provider but not configuring real credentials.
2. `npm run dev`, then:
   - Visit `/` while logged out → confirm it redirects to `/login`.
   - On `/signup`, click "Continue with Google" → complete the OAuth flow → confirm you land on `/` and, in the Table Editor, that your `profiles` row has `name`/`avatar_url` populated from your Google account.
   - Log out, sign up again with email/password on `/signup` → confirm the `profiles` row exists with `name` falling back to the email's local part (`avatar_url` null).
   - While logged in, visit `/login` or `/signup` directly → confirm you're redirected back to `/`.
3. Record the result somewhere durable (PR description, ticket comment) — same as the Ticket 2 RLS check, this is the acceptance criterion for this ticket, not something provable from the code alone.

## Ticket 5 manual verification (onboarding)

Same database-connection restriction as above.

1. Push `migrations/20260820000000_complete_onboarding_rpc.sql` (included in `supabase:push:dev`/`supabase:push:prod`).
2. `npm run dev`, sign up a new user → confirm you land on `/onboarding`, not `/`.
3. Submit the onboarding form → confirm you land on `/`, and in the Table Editor: the `profiles` row has `name`/`height_cm`/`goal_weight_kg`/`goal_type` set, and a single `weight_logs` row exists for that user with the entered weight.
4. Reload the app (or log out and back in) as that same user → confirm you land on `/` directly, skipping `/onboarding`.
5. As that same onboarded user, navigate to `/onboarding` directly → confirm it redirects to `/`.
6. Record the result somewhere durable (PR description, ticket comment) — same as prior tickets, this is the acceptance criterion, not something provable from the code alone.
