# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Forklore — pantry, recipe, and calorie tracking, solo or shared with a household group. Vite + React + TypeScript SPA (no SSR), MUI v6, installable as a PWA, backed by Supabase (Postgres/Auth/RLS/Edge Functions) with a Dexie (IndexedDB) local-first offline layer. Deployed as a static SPA to Cloudflare Pages.

## Commands

```bash
npm install
npm run dev              # vite dev server, --mode dev (.env.dev)
npm run build             # tsc -b && vite build --mode prod
npm run build:dev         # tsc -b && vite build --mode dev
npm run preview           # preview a production build
npm run lint               # oxlint
```

There is no test suite/framework configured in this repo (no jest/vitest, no `test` script) — do not assume one exists. `tsc -b` (via the build scripts) and `oxlint` are the only automated verification available; treat a clean run of both as the bar before considering a change done.

### Supabase (**never run these — see below**)

```bash
npm run supabase:push:dev|prod              # scripts/supabase-push.sh
npm run supabase:deploy-functions:dev|prod  # scripts/supabase-deploy-functions.sh
```

**Org policy: must not connect to databases.** Concretely, this means:
- Never run `supabase db push`, `supabase link`, or otherwise apply/execute migrations against dev or prod.
- Author migrations as new timestamped files under `supabase/migrations/` (see naming convention there) and Edge Function code under `supabase/functions/`, but leave them unpushed.
- Document every migration you add — and any manual verification it needs — as a new dated entry in `docs/pending-deviations.md`, following the existing entries' format (Deviation / Why / Not yet verified), and add the corresponding manual QA steps to `supabase/README.md`. This is the established pattern throughout this repo's history — every migration so far has been written, reviewed, and left for a human to push and verify against a live project.

## Architecture

The full living spec lives in `docs/` — read it before making non-trivial changes, since a lot of "why" here isn't derivable from the code alone:
- `docs/frontend-architecture.md` — stack rationale, project structure, Dexie schema, Zustand stores, offline sync/outbox design, logout behavior, navigation animation rules, photo handling.
- `docs/routes.md` — full route table and the reasoning behind personal-vs-group route duplication instead of a unified `:contextId` param.
- `docs/schema.md` — Postgres schema, RLS policy patterns, triggers, delete/cascade behavior.
- `docs/rpcs.md` — decision rule for RLS vs. Postgres RPC vs. Edge Function, and the current Phase 1 functions.
- `docs/mocks/design-system.md` — Everforest MUI theme, elevation/shadow system, component patterns, copy conventions.
- `docs/pending-deviations.md` — **append-only changelog of where the shipped code deviates from the docs above**, organized by ticket, each with Deviation/Why/Not yet verified. This is the actual source of truth for current behavior where it conflicts with the "spec" docs — always check here before assuming a doc above is still accurate.
- `docs/phase-1-tickets.md` — ticket breakdown (scope/out-of-scope/acceptance criteria) for Phase 1.
- `supabase/README.md` — per-ticket manual verification steps for a human to run against a live project (migrations to push, click-through QA).

### Ownership model — the recurring pattern

`ingredients`, `recipes`, and `log_entries` all share a nullable `group_id`: `null` means personal (scoped to `created_by`/`logged_by`), a value means it belongs to that group. There are no separate personal/group tables — the same component and query logic is parameterized by `groupId` (`undefined` on the personal route, a uuid on the `/groups/:groupId/...` route). `log_entries` additionally splits `group_id` (which log it displays on) from `logged_by` (who actually logged it) so a shared group log and per-user personal history can coexist.

### RLS vs. RPC vs. Edge Function

Plain single-table ownership-checked CRUD is handled by RLS, not an application server layer — see `rpcs.md`'s decision rule. Reach for a Postgres RPC only for multi-table writes that must be atomic (e.g. `copy_recipe`), and an Edge Function only when an external HTTP call or a secret that can't reach the browser is involved (e.g. `get-upload-url` for R2 presigned uploads).

### Offline-first sync

Every read goes through Dexie (`dexie-react-hooks`'s `useLiveQuery`); every write lands in Dexie immediately and is queued in an `outbox` table, drained to Supabase by a sync worker with exponential backoff, distinguishing transient errors (retry, eventually `waiting_for_connectivity`, auto re-armed on the browser `online` event) from permanent errors (surfaced immediately as `failed`, never retried). Conflicts resolve last-write-wins on `updated_at`. See `frontend-architecture.md` for the full flow and code sketch before touching `src/sync/`.

### Photos

Compressed/converted to WebP client-side (`browser-image-compression`) before upload; stored in a public Cloudflare R2 bucket (not Supabase Storage), never processed server-side. The Edge Function only ever hands out a presigned upload URL — it never touches file bytes.

## Working in this repo

- Types that mirror a DB table or are shared across more than one feature/store/Dexie definition live in `src/types/`; both Dexie table interfaces and Supabase query types should import from there rather than redefining shape independently. Purely local types stay colocated as `ComponentName.types.ts`.
- Feature folders under `src/features/` are grouped by domain concept, not 1:1 with routes — a feature can span multiple routes plus non-route hooks/local state.
- When a requirement isn't covered by an existing doc/ticket, or a doc and the shipped code disagree, don't guess — check `docs/pending-deviations.md` first (it's usually already reconciled there), and if a real product/design decision is needed (not just a technical one), surface it rather than deciding unilaterally — see the "reverted" entry in `pending-deviations.md`'s meal-type section for the precedent.
- Any spec deviation you introduce should be recorded in `docs/pending-deviations.md` in the same Deviation/Why/Not yet verified format as existing entries, not left implicit in a commit message.
- For an entity with both a create dialog and a full detail/edit page (ingredients, recipes), the create dialog's form component (`IngredientForm.tsx`, `RecipeForm.tsx`) is create-only — it owns its own `DeferredPhotoUpload` and submits directly. The detail page (`IngredientDetail.tsx`, `RecipeDetail.tsx`) does **not** reuse that form component for editing; it inlines its own fields and stages them in local state (`savedX` baseline + a dirty-check), with the photo lifted out to its own row above an explicit "Save changes" button. Don't reach for the *Form component when adding edit-path UI to a detail page — inline it there instead, matching this existing split.
- Kcal-per-unit/per-gram rate math (`quantity > 0 ? kcal / quantity : 0`) has a shared helper, `src/lib/kcal.ts` (`kcalPerUnit` for the raw number, `formatKcalPerUnit` for the `.toFixed(2)`-formatted display string) — use it instead of re-deriving the calc inline. Every rendered kcal value in the app is formatted `.toFixed(2)`, by explicit request — keep new kcal displays consistent with that (excluding a form `TextField`'s own live-typed `value=`, which should never be forcibly reformatted).
- This repo has no Prettier config, and its actual style is single quotes with wider (~100–110 col) lines — but some editor in this workflow occasionally auto-reformats a touched file to Prettier's own defaults (double quotes, 80-col rewrap) on save, independent of any real edit. This has silently 10x'd a diff's line count more than once. Before committing, skim `git diff --stat` for a file whose changed-line count looks disproportionate to the actual edit — if you find one, diff it against its last committed version to confirm, then hand-restore the pre-reformat style, reapplying only the genuine change on top, rather than letting the noise ride into the commit.
