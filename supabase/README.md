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
- RPC functions from `docs/rpcs.md` (e.g. `accept_group_invite`) are explicitly out of scope for this ticket — they land with Ticket 11. (`check_ingredient_usage` was pulled forward into Ticket 6, which needed it sooner — see that ticket's migration and `docs/pending-deviations.md`.)

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

## RLS recursion fix (`group_members`)

If step 2 above 500s with "infinite recursion detected in policy for relation group_members", push `migrations/20260821000000_fix_group_members_rls_recursion.sql` (see `docs/pending-deviations.md`) and retry. Also worth a quick spot-check afterward: as a user who belongs to at least one group, confirm a `groups`/`ingredients` read still succeeds (those policies transitively query `group_members` too).

## Ticket 6 manual verification (pantry / ingredient CRUD)

Same database-connection restriction as above.

1. Push `migrations/20260822000000_check_ingredient_usage_rpc.sql` (included in `supabase:push:dev`/`supabase:push:prod`) — deploys `check_ingredient_usage` ahead of Ticket 11, since this ticket's delete flow needs it now.
2. `npm run dev`, log in, land on `/pantry`. Tap the FAB, add an ingredient (name, quantity, unit, kcal, optional photo URL) → confirm it appears in the list with the correct card layout (thumbnail/placeholder, quantity+unit subtitle, kcal + per-unit rate).
3. Tap the card → edit a field, save → confirm the change persists after navigating back to `/pantry` and reopening it.
4. Delete an ingredient not used in any recipe → confirm the dialog shows a plain confirmation (no recipe list) before deleting.
5. Once Ticket 7 (recipes) exists, add an ingredient to a recipe, then try deleting that ingredient → confirm the dialog names the affected recipe(s) before proceeding, and that confirming still deletes it (cascade removes it from `recipe_ingredients`).
6. As a second user, confirm `/pantry` never shows the first user's ingredients (RLS: `group_id is null and created_by = auth.uid()`).
7. Record the result somewhere durable (PR description, ticket comment) — same as prior tickets, this is the acceptance criterion, not something provable from the code alone.

## Ticket 8 fast-follow manual verification (log entry edit/delete)

Same database-connection restriction as above.

1. Push `migrations/20260823000000_log_entries_delete_policy.sql` (included in `supabase:push:dev`/`supabase:push:prod`) — `log_entries` had select/insert/update policies from the Ticket 2 migration but no delete policy; this adds one mirroring the existing update policy's shape.
2. `npm run dev`, log in, log an ingredient or recipe from `/log`. Tap the resulting card → edit the name/kcal/quantity, save → confirm the change persists after reloading `/log` and `/logs`.
3. Tap a card, then "Delete entry", confirm → confirm it disappears from both `/log` and `/logs`, and today's running total updates accordingly.
4. As a second user, confirm they cannot update or delete the first user's log entries directly against the API (RLS: `logged_by = auth.uid()`).
5. Record the result somewhere durable (PR description, ticket comment) — same as prior tickets, this is the acceptance criterion, not something provable from the code alone.

## Ticket 10 manual verification (Dexie + outbox wiring)

Same database-connection restriction as above — no migration to push for this ticket (it wires existing screens to existing tables), but the offline/reconnect behavior itself needs a human with real DevTools network throttling.

1. `npm run dev`, log in, visit `/pantry`, `/recipes`, and `/log` once each while online, so Dexie has a first pull cached (check DevTools → Application → IndexedDB → `calorie-app` → `ingredients`/`recipes`/`log_entries` have rows).
2. Open DevTools → Network → set throttling to "Offline." Add a new ingredient → confirm it appears in the pantry list immediately, and a corresponding row shows up in IndexedDB's `outbox` table with `status: "pending"`.
3. While still offline, edit that ingredient's kcal, then reload the page → confirm the pantry list still shows the ingredient (including the offline edit) — this is "opening the app offline shows cached data," except it's the same session/tab rather than a true cold offline load, which this environment can't simulate without a second device.
4. Set throttling back to "Online" (or "No throttling") → confirm the outbox drains (rows disappear from IndexedDB's `outbox` table) within a few seconds, and the ingredient/edit now appears in Supabase's Table Editor.
5. Repeat a create+offline+reconnect cycle for a recipe's own fields (name/servings) on `/recipes/:id` and for a log entry on `/log` → confirm the same outbox/drain behavior. Then, while online, edit a recipe's ingredient list (add/remove/change quantity) with throttling set to "Offline" → confirm it fails with a clear error (this part requires connectivity by design — see `docs/pending-deviations.md`, Ticket 10) rather than silently queuing.
6. Visit `/sync-status` during step 2 (while offline mutations are queued) → confirm queued items show up appropriately once they age past the retry backoff (or force this by throttling to "Offline" for over ~30s so the item reaches `waiting_for_connectivity`).
7. Record the result somewhere durable (PR description, ticket comment) — same as prior tickets, this is the acceptance criterion, not something provable from the code alone.

## Ticket 11 manual verification (groups, membership, invites)

Same database-connection restriction as above.

1. Push `migrations/20260826000000_group_rpcs.sql` and `migrations/20260827000000_preview_group_invite_rpc.sql` (both included in `supabase:push:dev`/`supabase:push:prod`) — deploys `create_group`, the previously-undeployed `accept_group_invite` from `docs/rpcs.md`, and `preview_group_invite` (the invite-confirmation fix, see `docs/pending-deviations.md`).
2. `npm run dev`, log in as user A, tap the new "Groups" header icon (from any of Pantry/Recipes/Log/Sync status) → confirm it navigates to `/groups`.
3. Tap the FAB, create a group (name required, description optional) → confirm it appears in the list immediately with "You're the owner" as its subtitle, and in the Table Editor that both a `groups` row (`owner_id` = A) and a `group_members` row (`role = 'owner'`) exist for it.
4. Tap the invite icon on that group's card → "Generate invite" → confirm a link (`/invite/<code>`) appears with a working copy button, and a `group_invites` row exists with a non-null `expires_at` (~7 days out) and null `accepted_at`.
5. Log in as user B (a different account, different browser/profile) and open the generated invite link → confirm a "Checking invite…" state, then "Join `<group name>`?" with "Join group"/"Not now" buttons — **not** an immediate join. Confirm in the Table Editor that nothing has changed yet (no new `group_members` row, `group_invites` still `accepted_at IS NULL`).
6. Tap "Not now" → confirm it lands on `/groups` and the invite is still unconsumed (re-opening the same link should show the same confirm screen again).
7. Re-open the link and tap "Join group" this time → confirm "Joining group…" then "You've joined `<group name>`", then "Go to groups" lands on `/groups` showing the group with "Member" as its subtitle. Confirm in the Table Editor: a `group_members` row now exists for B, and the `group_invites` row has `accepted_by`/`accepted_at` set.
8. Open the **same** invite link again (still logged in as B, or as a third user C) → confirm the preview step itself shows the "invalid or expired" error, not a confirm screen — this is `preview_group_invite` correctly reporting an already-used code without needing an accept attempt first (see step 9 for the concurrent case the acceptance criteria actually ask for).
9. Concurrent-acceptance check (the ticket's specific acceptance criterion beyond simple single-use): generate a fresh invite, preview it once as a user so it sits on the confirm screen, then fire two `accept_group_invite` calls at the same code at effectively the same time (e.g. two browser tabs both tapping "Join group" within the same second, or two `curl`/Postman requests against the PostgREST RPC endpoint fired back to back) — confirm exactly one succeeds and the other gets the "Invalid or expired invite code" error, and that only one new `group_members` row was created. This can't be verified by two sequential manual clicks (step 8 already covers that case); it specifically needs two requests genuinely in flight at once.
10. Let an invite sit unused past its `expires_at` (or manually backdate `expires_at` on a test row in the Table Editor) → confirm opening that link shows the expired/invalid error at the preview step, before any join attempt.
11. Record the result somewhere durable (PR description, ticket comment) — same as prior tickets, this is the acceptance criterion, not something provable from the code alone.

## Ticket 12 manual verification (group context switcher)

Same database-connection restriction as above. Needs at least two accounts that are both members of the same group (see Ticket 11's steps above to get there).

1. Push `migrations/20260828000000_ingredients_recipes_updated_by.sql` (adds `ingredients.updated_by`/`recipes.updated_by`, updates the `recalculate_recipe_kcal` trigger to set `updated_by`), `migrations/20260829000000_recipes_servings_to_weight.sql` (renames `recipes.servings` to `weight_g`, retyped to `numeric`), and `migrations/20260830000000_log_entries_snapshot_unit.sql` (adds `log_entries.snapshot_unit`) — all included in `supabase:push:dev`/`supabase:push:prod`.
2. `npm run dev`, log in as user A (a member of at least one group) and visit `/pantry` → confirm the context switcher chip reads "Personal" and lists "Personal" plus every group A belongs to when tapped.
3. Select a group from the chip → confirm the URL becomes `/groups/<id>/pantry`, the chip now shows that group's name, and the visible list changes (starts empty for a brand-new group).
4. Add an ingredient while in that group's context → confirm it appears in the group's pantry list, and in the Table Editor the new `ingredients` row has `group_id` set to that group (not null), `created_by` = A, and `updated_by` = null.
5. Switch the chip back to "Personal" → confirm the URL returns to `/pantry` and the list shows only A's personal ingredients (the one just added to the group should **not** appear here).
6. Repeat steps 3–5 for `/recipes` (including adding an ingredient to a group recipe via both "From pantry" and "New ingredient" in the Add ingredient dialog) and `/log` (logging both an ingredient and a recipe while in group context).
7. Log in as user B (a different account, same group) and visit `/groups/<id>/pantry|recipes|log` directly → confirm B sees the ingredient/recipe/log entry A added in steps 4–6 (allow up to the ~60s pull interval, or trigger it sooner by reloading/reconnecting) — this is the "changes are visible to other members" acceptance criterion.
8. As A, visit `/logs` (all-time log) → confirm it now shows the log entries logged in step 6's group context alongside personal ones, not personal-only — this exercises the `fetchAllLogEntries` fix in `docs/pending-deviations.md` (Ticket 12).
9. Confirm `/pantry/:ingredientId` and `/recipes/:recipeId` opened from inside a group's list carry the group in their URL (`/groups/:groupId/pantry/:id`) and that saving or deleting there navigates back to that group's list, not the personal one.
10. Creator/last-updated metadata: open the group ingredient from step 4 at `/groups/<id>/pantry/:id` → confirm it shows "Added by A" with the creation time, and **no** "Last updated by" line (never edited). Edit its kcal and save → confirm it now shows "Added by A" (no date on this line anymore) plus a separate "Last updated by A" line with the edit time. As user B, edit the same ingredient → confirm the "Last updated by" line now reads B instead of A.
11. Repeat step 10 for a group recipe's own fields (name/weight/photo) at `/groups/<id>/recipes/:id`. Then, without touching those fields, only add/remove/reweight an ingredient on that recipe and save → confirm "Last updated by" still updates to the acting user even though no recipe-field edit happened (exercises the `recalculate_recipe_kcal` trigger's own `updated_by = auth.uid()`, not `updateRecipe`).
12. Back on `/groups/<id>/pantry` and `/groups/<id>/recipes` (the list views, not detail), confirm each card's subtitle includes "· Added by <name>" for group-scoped items, and confirm personal `/pantry`/`/recipes` cards show no such text.
13. Recipe weight (personal or group, either works — not group-specific): on `/recipes`, create a recipe and enter its weight as `1.5` with unit `kg` → confirm the Table Editor's `recipes` row has `weight_g = 1500`. Open it back up → confirm the Weight field shows `1500` with unit `g` preselected (the entered `kg` isn't reconstructed). Add ingredients until `total_kcal` is nonzero → confirm the stat tile reads "kcal per gram" with a value equal to `total_kcal / weight_g` (2 decimal places), and that `/recipes`' card for it shows `1500 g` and `<value>/g` matching the same math.
14. Log that recipe from `/log`'s FAB ("Log this recipe" flow) → confirm the dialog asks for an amount in grams (not servings), and that the resulting `log_entries` row has `snapshot_quantity` equal to the grams you entered and `snapshot_kcal` equal to `total_kcal / weight_g * grams entered`.
15. Multi-ingredient save race (regression check): create a new recipe, add **two or more** ingredients to it without saving in between (so they're all pending in the draft), then click "Save changes" once → confirm the `/recipes` list card's total kcal matches the detail screen's "total kcal" stat tile exactly, and that the Table Editor's `recipes.total_kcal` for that row equals the correct sum of every added ingredient's contribution, not just one of them.
16. Log entry unit: log an ingredient with a distinctive unit (e.g. a "sachet" ingredient) from `/log`'s FAB → confirm its `LogEntryCard` shows the quantity and unit beside the name (e.g. "1 sachet"), and the Table Editor's `log_entries` row has `snapshot_unit` matching the ingredient's own `unit`. Log a recipe → confirm its card shows the grams eaten (e.g. "100 g") and the row's `snapshot_unit` is `'g'`. Tap either card to open Edit, confirm the Quantity field shows the correct unit as a read-only suffix, edit only the kcal value, save, and confirm the card's quantity/unit display is unchanged.
17. "Logged by" name: as user A, log an entry while in a group's context (`/groups/<id>/log`) → confirm the entry's card shows "· Logged by A" next to the time. Log in as user B (same group) and log an entry into the same group's log → confirm A's entry still shows "Logged by A" and B's new one shows "Logged by B" once it syncs. Switch to "Personal" (`/log`) → confirm no "Logged by" text appears on any personal entry, and confirm `/logs` (all-time) never shows it either.
18. Record the result somewhere durable (PR description, ticket comment) — same as prior tickets, this is the acceptance criterion, not something provable from the code alone.
