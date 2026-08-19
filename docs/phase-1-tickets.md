# Phase 1 tickets

Each section below is meant to be pasted as a single GitHub issue body. Sequence them in order — later tickets depend on earlier ones. Link the four core docs (`schema.md`, `rpcs.md`, `frontend-architecture.md`, `design-system.md`, `routes.md`) from your repo's `/docs` folder at the top of each issue when you paste it in.

Every ticket ends with the same "Spec deviations" instruction — do not remove it. Deviations accumulate in `docs/pending-deviations.md` throughout Phase 1; hand that file over for review once the phase wraps, before Phase 2 planning starts.

---

## Ticket 1: Project scaffold, theme, and PWA shell

**Depends on:** none

### Scope
- Initialize Vite + React + TypeScript project
- Install and configure MUI v6 with the Everforest theme (light + dark via `colorSchemes`) — see `design-system.md`
- Configure `vite-plugin-pwa` for the PWA shell (manifest, service worker precaching the app shell)
- Set up base folder structure per `frontend-architecture.md` (empty `features/`, `components/`, `types/`, `store/`, `sync/`, `lib/`, `theme/`)

### Out of scope
- Any actual feature/route content — this is scaffold only
- Dexie, Zustand store contents, Supabase connection

### Acceptance criteria
- [ ] App builds and runs locally with Vite
- [ ] Theme toggle (light/dark) works and matches Everforest colors from `design-system.md`
- [ ] Disabled ripple, non-default font, correct border radius confirmed visually
- [ ] PWA installable (manifest + service worker present), app shell loads offline after first visit

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 2: Supabase project setup and schema migration

**Depends on:** none (can run in parallel with Ticket 1)

### Scope
- Create Supabase project
- Run the full schema from `schema.md` (tables, enum, triggers, RLS policies) as a migration
- Verify RLS policies actually block cross-user/cross-group access (manual test with two accounts)

### Out of scope
- RPC functions from `rpcs.md` — separate ticket
- Any frontend code

### Acceptance criteria
- [ ] All tables from `schema.md` exist with correct columns/types
- [ ] `ingredient_unit` enum matches spec exactly
- [ ] RLS enabled on every table listed in `schema.md`
- [ ] Manual test: user A cannot read/write user B's personal ingredients; non-members cannot read a group's data

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 3: Auth flow and profile auto-fill

**Depends on:** Ticket 1, Ticket 2

### Scope
- Google SSO + email/password signup and login via Supabase Auth
- `handle_new_user` trigger from `schema.md` deployed and verified (profile row auto-created on signup, name/avatar populated for Google users)
- `/login`, `/signup` routes and forms
- Auth-gated routing (unauthenticated users redirected to `/login`)

### Out of scope
- Onboarding flow (height/weight/goal) — separate ticket, even though it follows signup
- Dexie/offline handling of the session

### Acceptance criteria
- [ ] Can sign up via Google, profile row exists with name + avatar populated automatically
- [ ] Can sign up via email/password, profile row exists with a fallback name
- [ ] Logged-out users cannot access any authenticated route

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 4: Dexie schema and Zustand store scaffold

**Depends on:** Ticket 1

### Scope
- Implement the Dexie schema exactly as defined in `frontend-architecture.md`
- Implement `useAppStore` and `useSyncStore` per `frontend-architecture.md`
- Types for all entities in `src/types/`, imported by both Dexie definitions and stores

### Out of scope
- Actual sync logic (outbox drain, pull) — separate ticket
- Wiring these into any real feature screen yet

### Acceptance criteria
- [ ] Dexie database initializes with all tables/indexes matching `frontend-architecture.md`
- [ ] Zustand stores exist and are typed correctly
- [ ] `src/types/` files exist for ingredient, recipe, log, group, profile, sync — used by Dexie definitions rather than inline shapes

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 5: Onboarding flow

**Depends on:** Ticket 3

### Scope
- `/onboarding` route: collect height, weight (writes initial `weight_logs` entry), goal weight, goal type
- Redirect here automatically after first signup if `profiles.height_cm` is null
- Pre-fill name from profile if already set (Google SSO case)

### Out of scope
- Progress/trend visualization — separate ticket
- Editing these values later (that's the Profile screen, separate ticket)

### Acceptance criteria
- [ ] New user is routed to onboarding before reaching any other screen
- [ ] Submitting creates/updates the profile row and inserts the first `weight_logs` entry
- [ ] Returning users (height already set) skip onboarding entirely

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 6: Ingredient CRUD (pantry, personal only)

**Depends on:** Ticket 2, Ticket 3

### Scope
- `/pantry` and `/pantry/:ingredientId` routes
- Create/read/update/delete ingredients, **personal context only** — hardcode `group_id = null` for now
- Form fields: name, quantity, unit (dropdown from the `ingredient_unit` enum), kcal, optional photo URL (plain text field for now, not real upload)
- List view uses the card pattern from `design-system.md`
- Delete flow calls `check_ingredient_usage` RPC and shows a confirmation naming affected recipes before proceeding

### Out of scope
- Group context (that's Ticket 12)
- Offline/Dexie reads or writes — read/write directly to Supabase for now (Ticket 10 retrofits this)
- Real photo upload/compression (Ticket 15)

### Acceptance criteria
- [ ] Can create, edit, delete a personal ingredient
- [ ] Unit dropdown only allows enum values
- [ ] Deleting an ingredient used in a recipe shows a confirmation naming the recipe(s) first
- [ ] List view matches the card pattern (thumbnail/placeholder, title+subtitle, kcal+per-unit rate)

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 7: Recipe CRUD (personal only)

**Depends on:** Ticket 6

### Scope
- `/recipes` and `/recipes/:recipeId` routes, personal context only (`group_id = null`)
- Create/edit a recipe: name, servings, optional photo, add ingredients from the personal pantry with a quantity (unit is read-only, inherited from the ingredient — not user-selectable)
- Confirm `total_kcal` recalculates correctly via the database trigger when ingredients are added/removed/quantity changed
- Recipe detail view matches the hero-photo + total/per-serving kcal + ingredient list pattern established in the design mockups

### Out of scope
- Group context (Ticket 12)
- Recipe copying/forking (Ticket 14)

### Acceptance criteria
- [ ] Can create a recipe, add ingredients with quantities, see correct total and per-serving kcal
- [ ] Editing ingredient quantities updates `total_kcal` automatically (verifies the trigger, not client-side math)
- [ ] Unit field in the ingredient-adding UI is read-only, shown next to the quantity input

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 8: Logging (daily log + all-time log, personal only)

**Depends on:** Ticket 6, Ticket 7

### Scope
- `/log` (personal daily log) and `/logs` (all-time, cross-context) routes
- Log an entry by selecting an existing ingredient or recipe — writes a **snapshotted** `log_entries` row (copy name/kcal/quantity at insert time, do not reference live data afterward)
- Daily log shows today's total + itemized list
- All-time log (`/logs`) queries by `logged_by` only, no `group_id` filter — will show only personal entries until groups exist (Ticket 12), but the query itself should already be written to include group entries by design

### Out of scope
- Group-scoped log (`/groups/:groupId/log`) — Ticket 12
- Editing an already-logged entry's snapshot values (mention as a fast-follow if time allows, not required for this ticket)

### Acceptance criteria
- [ ] Logging a recipe or ingredient creates a `log_entries` row with correct snapshot values
- [ ] Editing or deleting the source ingredient/recipe afterward does not change the already-logged entry
- [ ] `/log` shows today's entries + running total; `/logs` shows full history

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 9: Outbox pattern with backoff and reconnect retry

**Depends on:** Ticket 4

### Scope
- Implement `outbox.ts` per `frontend-architecture.md`: enqueue mutations, drain with exponential backoff, distinguish transient vs. permanent errors
- `waiting_for_connectivity` items automatically re-attempt on the browser's `online` event
- `useSyncStore` reflects current status (`idle`/`syncing`/`error`) for UI consumption

### Out of scope
- Wiring this into existing CRUD screens (Ticket 10)
- Any UI beyond a basic sync status indicator — full "sync issues" screen UI can be a fast-follow

### Acceptance criteria
- [ ] A queued mutation retries automatically on transient failure, with increasing delay
- [ ] After 5 failed attempts, item is marked `waiting_for_connectivity`, not deleted or permanently failed
- [ ] Simulated permanent error (e.g. RLS denial) is marked `failed` immediately, no retry attempted
- [ ] Reconnecting (`online` event) automatically retries all `waiting_for_connectivity` items

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 10: Wire Dexie + outbox into existing CRUD screens

**Depends on:** Ticket 6, Ticket 7, Ticket 8, Ticket 9

### Scope
- Replace direct Supabase reads in Pantry/Recipes/Log screens with Dexie live queries (`useLiveQuery`)
- Replace direct Supabase writes with: write to Dexie immediately (optimistic UI) + enqueue to outbox
- Implement the pull side: fetch changes since last sync per table, merge into Dexie

### Out of scope
- Group-scoped data (Ticket 12 adds groups; this ticket's pull/push logic should be written generically enough to handle a `group_id` filter without rework, but doesn't need to be tested against real group data yet)

### Acceptance criteria
- [ ] Creating/editing an ingredient while offline updates the UI immediately and appears in the outbox
- [ ] Reconnecting drains the outbox and the change appears in Supabase
- [ ] Opening the app offline (after first load) shows previously-cached pantry/recipe/log data from Dexie

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 11: Group CRUD, membership, and invites

**Depends on:** Ticket 2, Ticket 3

### Scope
- `/groups` route: list groups the user belongs to, create a new group
- `accept_group_invite` RPC wired to `/invite/:inviteCode` route
- Generate/share an invite code (owner only)
- Deploy `check_ingredient_usage` and other Phase 1 RPCs from `rpcs.md` if not already deployed alongside Ticket 2

### Out of scope
- Group-scoped pantry/recipes/log screens (Ticket 12)
- Group settings screen beyond basic creation (Ticket 13)

### Acceptance criteria
- [ ] Can create a group, becomes owner automatically
- [ ] Invite code can be generated and shared; accepting it via `/invite/:inviteCode` adds the user as a member
- [ ] Invite code cannot be used twice (verify the `for update` lock actually prevents double-acceptance under concurrent attempts)
- [ ] Expired invite codes are rejected

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 12: Group context switcher applied across Pantry/Recipes/Log

**Depends on:** Ticket 10, Ticket 11

### Scope
- Implement `/groups/:groupId/pantry`, `/groups/:groupId/pantry/:ingredientId`, `/groups/:groupId/recipes`, `/groups/:groupId/recipes/:recipeId`, `/groups/:groupId/log` — reusing the same components as their personal-route counterparts, per `routes.md`
- Context switcher chip (per `design-system.md`) on Pantry/Recipes/Log screens, lets the user pick personal or any group they belong to
- Verify Dexie/outbox sync correctly scopes to `group_id` (null vs. specific group) for both push and pull

### Out of scope
- `/groups/:groupId/settings` (Ticket 13)

### Acceptance criteria
- [ ] Switching context in the chip updates the URL and re-scopes the visible pantry/recipes/log data
- [ ] A group member can add/edit ingredients and recipes in that group's context; changes are visible to other members
- [ ] Personal and group data never bleed into each other in either direction

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 13: Group settings screen

**Depends on:** Ticket 12

### Scope
- `/groups/:groupId/settings` route, owner-only (enforced by RLS + hidden in UI for non-owners)
- Rename group, edit description, remove members, delete group

### Out of scope
- Transferring ownership (not in the original feature list — flag as a possible future addition, don't build it)

### Acceptance criteria
- [ ] Non-owners cannot access this screen (redirected or hidden entry point)
- [ ] Owner can rename, edit description, remove a member, delete the group
- [ ] Deleting the group cascades correctly (ingredients/recipes/logs removed per `schema.md`)

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 14: Ingredient and recipe copy/fork

**Depends on:** Ticket 12

### Scope
- "Copy to..." action on ingredients and recipes, offering personal or any group the user belongs to as the target
- Ingredient copy: straightforward, via `copy_ingredient` RPC
- Recipe copy: run `find_ingredient_match` per ingredient first; only show a confirmation dialog for genuine matches (same name AND same unit); silently create fresh copies for everything else; confirmation dialog offers "use existing" or "add as new" only — no overwrite option
- Call `copy_recipe` RPC with the resolved ingredient mapping

### Out of scope
- Community feed forking (`forked_from_recipe_id` usage in a public-feed context) — Phase 3

### Acceptance criteria
- [ ] Copying an ingredient in any direction (group→group, group→personal, personal→group) creates a correct independent copy
- [ ] Copying a recipe whose ingredients have no match in the target context creates fresh ingredient copies automatically, no prompt shown
- [ ] Copying a recipe whose ingredient has an exact name+unit match in the target context prompts the user, and both "use existing" and "add as new" work correctly
- [ ] A name match with a different unit is never offered as a selectable match

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 15: Photo upload (R2 + client-side compression)

**Depends on:** Ticket 6, Ticket 7

### Scope
- `get-upload-url` Edge Function per `rpcs.md`
- Client-side compression/WebP conversion (`browser-image-compression`) before requesting the upload URL
- Wire real photo upload into the ingredient and recipe forms (replacing the plain text `photo_url` field from Tickets 6/7)
- Missing-photo state uses the generic placeholder per `design-system.md`

### Out of scope
- Thumbnail variants — single compressed size only, per `frontend-architecture.md`

### Acceptance criteria
- [ ] Taking/selecting a photo compresses it client-side to ~300KB, 1024px max, WebP format before upload
- [ ] Uploaded photo appears correctly in the ingredient/recipe card and detail view
- [ ] Ingredients/recipes without a photo show the generic placeholder, not a broken image or category icon

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 16: Navigation animations

**Depends on:** most feature routes existing (Tickets 6–13 at least partially complete, so there's real navigation to animate)

### Scope
- Framer Motion `AnimatePresence` wrapper around the router outlet per `frontend-architecture.md`
- Push/pop slide transition for depth navigation (e.g. `/pantry` → `/pantry/:id`, opening `/profile`)
- Fade/instant transition for switching between the four bottom tabs
- FAB and other floating elements positioned correctly relative to the screen root (not a local zero-height wrapper — see the bug noted in `design-system.md`)

### Out of scope
- Gesture-driven edge-swipe-to-go-back — explicitly deferred, do not attempt even if it seems like a natural extension of this ticket

### Acceptance criteria
- [ ] Navigating into a detail screen slides in from the right; navigating back slides out to the right
- [ ] Switching bottom tabs has no directional slide
- [ ] No layout bugs from incorrect positioning contexts (verify FAB placement specifically)

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 17: Profile screen and logout

**Depends on:** Ticket 3, Ticket 9

### Scope
- `/profile` route, reached via header avatar icon (not a bottom tab) per `routes.md`
- View/edit name, avatar, height; logout button; theme toggle
- Logout flow per `frontend-architecture.md`: check outbox count first, warn with the actual pending count if non-zero, clear Dexie entirely on confirmed logout

### Out of scope
- Weight/goal editing — that's Progress (Ticket 18), profile is account-level info only

### Acceptance criteria
- [ ] Can view and edit name/height from this screen
- [ ] Logging out with an empty outbox proceeds immediately
- [ ] Logging out with pending outbox items shows a warning with the correct count and requires confirmation
- [ ] Confirmed logout clears Dexie and returns to `/login`

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.

---

## Ticket 18: Progress screen (weight/BMI tracking)

**Depends on:** Ticket 5

### Scope
- `/progress` route — always personal, ignores active group context entirely (no context switcher shown)
- Weight history chart (from `weight_logs`), current BMI (weight ÷ height²), goal weight/type display
- Ability to log a new weight entry from this screen

### Out of scope
- Any group-level aggregate stats (not part of the feature list — Progress is individual only)

### Acceptance criteria
- [ ] Logging a new weight entry adds a `weight_logs` row and updates the chart
- [ ] BMI displayed is calculated correctly from the latest weight and `profiles.height_cm`
- [ ] Screen content is identical regardless of which group context is active elsewhere in the app (confirms it's correctly excluded from the switcher's scope)

### Spec deviations
If implementation requires deviating from the spec (schema, routes, or design system), do not edit the doc files to match. Make the code change, then append an entry to `docs/pending-deviations.md` (create it if it doesn't exist yet) under a heading naming this ticket, in this format:

```markdown
## Ticket N — <ticket title>
**Deviation:** what changed
**Why:** why it was necessary
```

Do not edit the core doc files themselves — deviations are reviewed and folded in separately, after Phase 1 wraps.
