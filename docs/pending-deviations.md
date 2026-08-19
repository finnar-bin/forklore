# Pending spec deviations

Deviations from `schema.md` / `rpcs.md` / `frontend-architecture.md` / `design-system.md` / `routes.md` accumulate here during Phase 1. Review and fold into the core docs after Phase 1 wraps.

---

## Ticket 2 — Supabase project setup and schema migration

**Deviation:** `schema.md`'s RLS section gives explicit `select`/`insert`/`update` policies only for `ingredients` (with an instruction to copy the same three-policy shape to `recipes` and `log_entries`), plus `select`/`update`/`delete` for `groups`. It does not give any policies at all for `profiles`, `weight_logs`, or `group_invites`, doesn't give `group_members` policies beyond "enable RLS", and doesn't give `delete` policies for `ingredients`/`recipes`/`recipe_ingredients`. The migration (`supabase/migrations/20260819000000_phase1_schema.sql`) fills these gaps with:
- `profiles`: select own row or a fellow group member's row; update own row only.
- `weight_logs`: select/insert/update own rows only (personal, no group scope — matches Progress being individual-only per ticket 18).
- `groups`: added an `insert` policy (`owner_id = auth.uid()`) since none was given and group creation needs one.
- `group_members`: select rows in any group the caller belongs to; delete restricted to the group's owner. No client-side insert policy — membership rows are created via the group-creation flow and the `accept_group_invite` RPC (`security definer`, bypasses RLS).
- `group_invites`: select/insert restricted to the inviting group's owner. No update — `accepted_by`/`accepted_at` are set only via the `accept_group_invite` RPC.
- `ingredients`, `recipes`, `recipe_ingredients`: added `delete` policies mirroring the existing ownership pattern (needed for ingredient delete in ticket 6, and removing an ingredient from a recipe in ticket 7).

**Why:** The acceptance criteria for this ticket require RLS enabled on every table listed in `schema.md`, and the app can't function (profile reads, group creation, ingredient delete, etc.) with RLS enabled but zero policies on these tables. All new policies extend the existing "personal row owned by caller, or caller is a member of the owning group" pattern already established in the doc rather than introducing a new access model.

**Not yet verified:** This migration has not been applied to a live Supabase project or manually tested against two accounts (agent tooling restrictions in this session prohibit connecting to any database). Applying it, running it, and doing the manual cross-user/cross-group RLS check are left as a manual follow-up — see `supabase/README.md`.

**Deviation (env/deploy tooling):** `schema.md`/`phase-1-tickets.md` don't specify how Supabase credentials should be configured or how migrations get pushed to a given environment. Added `.env.dev` / `.env.prod` (gitignored, with `.env.dev.example` / `.env.prod.example` templates committed) holding `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF`, and `SUPABASE_ACCESS_TOKEN` per environment; Vite picks the right file via `--mode dev`/`--mode prod` (wired into `npm run dev` / `build` / `build:dev`); and two new npm commands, `supabase:push:dev` and `supabase:push:prod`, run `scripts/supabase-push.sh` to `supabase link` + `supabase db push` against the matching project. **Why:** requested directly (not part of a numbered ticket) to give dev/prod Supabase projects a repeatable, one-command way to receive schema pushes. Not yet run against a live project for the same database-connection reason as above.

---

## Ticket 3 — Auth flow and profile auto-fill

**Deviation:** `routes.md` doesn't define a root (`/`) path — its list starts at `/login`. Added `/` as a temporary authenticated landing page (`src/routes/HomePage.tsx`) so `RequireAuth` has a real protected route to gate, and so logged-in users land somewhere after signup/login instead of a blank screen. It shows a placeholder card plus a logout button; it isn't one of the Phase 1 feature screens (Pantry/Recipes/Log/Progress) and is expected to be replaced once Ticket 6 (Pantry) or a real default-landing decision exists.

**Deviation:** `frontend-architecture.md` specifies `useAppStore` (`userId`, `activeGroupId`) as part of Ticket 4's scope, not Ticket 3's. Auth-gated routing needs *some* shared place to hold "is there a logged-in user," so this ticket adds `src/store/useAppStore.ts` now, implementing the interface exactly as documented in `frontend-architecture.md`. `activeGroupId`/`setActiveGroup` are included (unused by this ticket) rather than a partial shape, so Ticket 4 doesn't need to redefine the store — it should only need to add `useSyncStore` and wire Dexie.

**Why:** Both changes exist to satisfy this ticket's "auth-gated routing" acceptance criterion with no upstream ticket yet providing a landing route or a session store; the docs don't specify a normative first draft for either.

**Not yet verified:** `handle_new_user` (name/avatar auto-fill for Google SSO, fallback name for email/password) is implemented in the Ticket 2 migration and the frontend code paths that exercise it (Google OAuth button, email/password signup form, auth-gated redirect) were exercised locally against the dev Supabase project far enough to confirm the Auth API call reaches Supabase and errors round-trip correctly into the UI (a deliberately-invalid signup returned a real Supabase 400 and rendered correctly). Completing an actual signup and inspecting the resulting `profiles` row was not done in this session — agent tooling restrictions prohibit connecting to any database, and a completed signup writes real rows to `auth.users`/`profiles` via the trigger. Manual follow-up needed (see `supabase/README.md`): sign up via Google, confirm `profiles.name`/`avatar_url` are populated from the Google account; sign up via email/password, confirm `profiles.name` falls back to the email's local part; confirm a logged-out request to `/` redirects to `/login` and a logged-in visit to `/login`/`/signup` redirects to `/`.

---

## Ticket 5 — Onboarding flow

**Deviation:** `rpcs.md` has no entry for onboarding submission. Onboarding writes span two tables — `profiles` (name/height/goal fields) and `weight_logs` (the first weight entry) — which must succeed or fail together, matching this doc's own decision rule ("multi-table writes that must succeed or fail together -> Postgres RPC function"). Added `complete_onboarding(p_name, p_height_cm, p_weight_kg, p_goal_weight_kg, p_goal_type)` as a new `security definer` RPC (`supabase/migrations/20260820000000_complete_onboarding_rpc.sql`), following the same shape as the existing `accept_group_invite`/`copy_ingredient` functions.

**Deviation:** The onboarding submit calls this RPC directly against Supabase rather than going through the Dexie/outbox write path described in `frontend-architecture.md`. This mirrors how the auth feature (Ticket 3) already writes straight to Supabase (`signUpWithEmail`, `signInWithGoogle`, etc.) — onboarding happens immediately post-signup, before there's any reason to assume the device is offline, and `weight_logs` isn't part of the Dexie mirror in `frontend-architecture.md` in the first place (it's only needed for Progress, a separate ticket). The local `profiles` Dexie table is also not updated here, since the pull/sync engine (`src/sync/`) doesn't exist yet as of this ticket.

**Deviation:** `frontend-architecture.md` documents `useAppStore`'s `AppState` as `{ userId, activeGroupId }` plus their setters. Added `onboardingComplete: boolean | null` and `setOnboardingComplete` so `App.tsx` has a shared place to gate `/` vs `/onboarding` without every route re-querying Supabase. `null` means "not yet checked"; `setSession` resets it to `null` only when the userId actually changes (not on same-user auth events like token refresh), so `useOnboardingGate` (`src/features/onboarding/useOnboardingGate.ts`) re-derives it once per login/logout/account-switch, not on every auth state change.

**Deviation:** `routes.md` doesn't define a root (`/`) path (see Ticket 3's note above) — this ticket's `RequireOnboarded` guard sits on that same ad hoc `/` route, not a documented Phase 1 screen.

**Why:** All four exist to satisfy this ticket's acceptance criteria (route to onboarding before any other screen, atomic profile+weight_logs write, returning users skip onboarding) with no upstream ticket providing the RPC, store shape, or a real post-onboarding landing screen yet.

**Not yet verified:** Same database-connection restriction as Tickets 2/3 — this session's tooling can't connect to a database, so the migration hasn't been pushed or exercised against a live project. Manual follow-up needed (see `supabase/README.md`): push this migration; sign up a new user and confirm they're routed to `/onboarding` (not `/`); submit the form and confirm the `profiles` row picks up `name`/`height_cm`/`goal_weight_kg`/`goal_type` and a single `weight_logs` row is inserted; reload and confirm the same user now lands on `/` directly; visit `/onboarding` directly as that user and confirm it redirects to `/`.

---

## Fix — `group_members` RLS infinite recursion (found during Ticket 5 verification)

**Deviation:** Two of Ticket 2's RLS policies caused Postgres to report "infinite recursion detected in policy for relation group_members" on any read that touched `profiles` or `group_members` (first observed via `GET /rest/v1/profiles?select=height_cm`, i.e. `useOnboardingGate`). `"members read group membership"` (on `group_members`) queried `group_members` from inside its own `USING` clause; `"read own or group-mate profiles"` (on `profiles`) self-joined `group_members` twice, which hit that same recursive policy. Fixed in `supabase/migrations/20260821000000_fix_group_members_rls_recursion.sql` by adding `is_group_member`/`shares_group_with` `security definer` helper functions (same table-owner-bypasses-RLS pattern already used by `accept_group_invite`) and rewriting those two policies via `alter policy ... using (...)` to call them instead of self-referencing subqueries.

**Why:** Not a spec deviation so much as a correctness bug in the Ticket 2 migration's RLS gap-fill — logged here rather than editing that ticket's entry above, since this is a later migration, not a rewrite of history.

**Not yet verified:** Same database-connection restriction as above. Manual follow-up: push this migration, then retry the failing `profiles` read (e.g. reload `/onboarding` as a fresh signup) and confirm it succeeds; also spot-check a `groups`/`ingredients` read for a user in at least one group, since those policies transitively query `group_members` too.

---

## Ticket 6 — Ingredient CRUD (pantry, personal only)

**Deviation:** `check_ingredient_usage` (rpcs.md) hadn't been deployed by any prior migration — `rpcs.md`/`phase-1-tickets.md` group deploying "Phase 1 RPCs... if not already deployed alongside Ticket 2" under Ticket 11's scope, but this ticket's delete flow needs it now. Added `supabase/migrations/20260822000000_check_ingredient_usage_rpc.sql`, deploying the function exactly as specified in `rpcs.md`, no changes to its shape.

**Deviation:** `routes.md` lists only `/pantry` and `/pantry/:ingredientId` for this ticket — no creation route. Rather than inventing an undocumented URL (e.g. `/pantry/new`), the FAB on `/pantry` opens an in-place create dialog (`CreateIngredientDialog`); `/pantry/:ingredientId` is used for viewing, editing, and deleting an existing ingredient.

**Deviation:** Removed the temporary `HomePage`/`"/"` landing screen added in Ticket 3 and flagged in Tickets 3 and 5 as expected to be replaced once Pantry existed. `"/"` now redirects to `/pantry`. `design-system.md` documents profile/account actions (logout, theme toggle) as living behind a header avatar icon that opens `/profile`, but that screen is Ticket 17 and doesn't exist yet — so, matching `HomePage`'s prior treatment, the new shared `AppHeader` (`src/components/AppHeader.tsx`, used by both Pantry routes) inlines a theme-toggle button and a logout button directly instead. Expected to be replaced by the avatar-icon pattern once Ticket 17 lands.

**Deviation:** `design-system.md`'s 4-tab bottom navigation (Pantry/Recipes/Log/Progress) is not implemented yet. Only Pantry has a real screen at this point — Recipes, Log, and Progress don't exist until their own tickets (7, 8, 18) — so a nav bar linking to them would either 404 or link nowhere useful. Expected to land incrementally as those tickets are completed, fully wired by Ticket 16 (navigation animations).

**Why:** All four exist to satisfy this ticket's acceptance criteria (working create/edit/delete, delete confirmation naming affected recipes) given routes/screens that later tickets haven't built yet, without inventing undocumented routes or full nav structure ahead of the screens it would point to.

**Not yet verified:** Same database-connection restriction as Tickets 2/3/5 — this session's tooling can't connect to a database (org policy: must not connect to databases), so the new `check_ingredient_usage` migration hasn't been pushed, and the full CRUD flow hasn't been exercised against the live dev Supabase project. Manual follow-up needed (see `supabase/README.md`): push this migration; create a personal ingredient and confirm it appears only in the creating user's pantry (not another user's); edit it and confirm the change persists; add it to a recipe (once Ticket 7 exists) and confirm deleting it shows the recipe-usage confirmation before proceeding; confirm deleting an ingredient with no recipe usage skips straight to a plain confirmation.
