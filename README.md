# Forklore

Pantry, recipe, and calorie tracking — solo or shared with your household group.

Vite + React + TypeScript SPA, themed with MUI v6 and installable as a PWA. Backed by Supabase (Postgres/Auth/RLS/Edge Functions) with a Dexie (IndexedDB) local-first offline layer, so every read/write hits local storage first and syncs to Supabase in the background. Deployed as a static SPA to Cloudflare Pages.

See `docs/` for the schema, RPCs, frontend architecture, routes, and design system specs driving implementation — `docs/pending-deviations.md` is the source of truth where shipped behavior has drifted from those specs.

## Features

- **Pantry** — personal or group ingredient library, with kcal-per-unit tracking, brand, photos, and a shared community pantry to copy ingredients from.
- **Recipes** — build recipes from pantry ingredients, with auto-calculated kcal totals/servings and a copy-to-my-pantry/recipes flow.
- **Logging** — log ingredients or recipes eaten by meal type, personally or on a group's shared log (including logging on another member's behalf), with a daily view and an all-time history.
- **Groups** — create/join a household group via invite, manage members, and scope pantry/recipes/log to the group instead of personal.
- **Progress** — track weight and calorie goals against a BMI-informed target, charted over time.
- **Onboarding** — guided setup for a calorie target and joining/creating a group, required before using the app.
- **Offline-first** — every read/write goes through Dexie locally first; a sync worker drains queued changes to Supabase with retry/backoff, so the app works fully offline and reconciles when connectivity returns.
- **PWA** — installable, with an update-available prompt.

## Develop

```bash
npm install
npm run dev              # vite dev server, --mode dev (.env.dev)
```

Copy `.env.dev.example` to `.env.dev` (gitignored) and fill in your Supabase project's URL/anon key to run against a real backend.

## Build

```bash
npm run build             # tsc -b && vite build --mode prod
npm run build:dev         # tsc -b && vite build --mode dev
npm run preview           # preview a production build
```

## Lint & format

```bash
npm run lint               # oxlint
npm run format              # prettier --write .
npm run format:check        # prettier --check .
```

There is no automated test suite in this repo — `tsc -b`, `oxlint`, and `prettier --check` are the available verification.

## Backend (Supabase)

Schema migrations live in `supabase/migrations/`, Edge Functions in `supabase/functions/` (`get-upload-url` for presigned Cloudflare R2 photo uploads, `delete-photo`). See `supabase/README.md` for manual QA steps per change.

```bash
npm run supabase:push:dev|prod              # push pending migrations
npm run supabase:deploy-functions:dev|prod  # deploy edge functions
```
