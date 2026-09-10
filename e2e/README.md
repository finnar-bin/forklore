# End-to-end tests

Playwright, driving a real browser against the real app (`vite --mode test`,
real Dexie/IndexedDB, real outbox/sync code) — but with Supabase itself
replaced by an in-process mock, never a real project. See "Why no real
Supabase" below for why that's not just a convenience but a hard
requirement here.

## Running

```bash
npm run test:e2e            # headless, once
npm run test:e2e:ui         # Playwright's UI mode — watch it run, time-travel
npm run test:e2e:report     # open the last run's HTML report
```

First time only:

```bash
npx playwright install chromium
```

`playwright.config.ts` starts `vite --mode test` itself (reading
`.env.test`) and waits for it to be ready — no separate `npm run dev` needed
first.

## Why no real Supabase

This repo's org policy (CLAUDE.md) is **must not connect to databases** —
no `supabase db push`/`link`, and by extension no test run should touch a
real Supabase project (dev, prod, or a scratch one), even read-only.

E2E-testing an app this Supabase-dependent without a backend at all would
normally mean either skipping most of the app or building a fragile pile of
per-test mocks. Instead, `e2e/mocks/mockBackend.ts` is a small in-memory
stand-in for a whole Supabase project — Auth (signup/login/logout/session),
PostgREST (`select`/`insert`/`update`/`delete` with the `eq`/`gt`/`gte`/`in`
filters, `select` column lists, the one embedded-relation query, and
`.single()` this app actually uses), the handful of Postgres RPCs
(`create_group`, `complete_onboarding`, `copy_recipe`, etc.), the
`recalculate_recipe_kcal` trigger, and the two Edge Functions
(`get-upload-url`/`delete-photo`). `.env.test` points `VITE_SUPABASE_URL` at
a fake host (`https://mock.supabase.test`); `MockBackend.install(page)`
registers a Playwright route handler for that host and answers every
request itself, entirely inside the test process. **No request from these
tests ever reaches a real network, let alone a real database** — this is
what makes the suite compatible with the org policy while still being a
genuine, full-stack-through-the-browser e2e test rather than a mocked
component test.

This also means each spec's own `backend` fixture (see `e2e/fixtures.ts`)
is a fresh, empty in-memory Supabase for that one test — no shared state,
no seed/teardown scripts, no cross-test pollution.

## Structure

- `mocks/mockBackend.ts` — the mock backend described above.
- `fixtures.ts` — extends Playwright's `test` with:
  - `backend` (auto-installed for every test, even one that never
    references it directly — see the comment on it) — the `MockBackend`
    instance, with `seedUser`/`seedGroup`/`seedRow`/`rows`/`setOffline`
    helpers for arranging state and asserting on what the app actually sent.
  - `seededUser` — a user with a completed profile and one group, so a test
    can skip onboarding.
  - `loginAsSeededUser` — drives the real login form, then picks the seeded
    group's card (there's no "last active group" yet in a fresh browser
    context — see `resolveDefaultGroupId` in `src/lib/defaultGroup.ts`).
- `specs/` — one file per feature area: `auth`, `onboarding`, `pantry`,
  `recipes`, `logging`, `groups`, `community-pantry`, `offline-sync`.

## Notable patterns

- **Offline/sync** (`offline-sync.spec.ts`): a Playwright
  `context.setOffline(true)` only blocks _real_ network traffic — a request
  this mock answers via `route.fulfill()` never reaches that layer, so it
  would "succeed" even while the browser context is offline. Calling the
  mock backend's own `setOffline(true)` (aborts every request instead) is
  what actually exercises `src/sync/outbox.ts`'s retry/backoff path; the
  context-level toggle alongside it is what fires the `online` event the
  outbox also listens for.
- **MUI X DatePicker** (`onboarding.spec.ts`): its field is a sectioned
  contenteditable, not a plain `<input>` — click it, then
  `page.keyboard.type("MMDDYYYY")` rather than `.fill()`.
- Ambiguous accessible names (e.g. a dialog titled "Add ingredient"
  containing a button also named "Add ingredient") come up often with this
  app's copy conventions — prefer a specific role with `exact: true` over
  `getByLabel`/`getByText` where two elements could plausibly match.

## What isn't covered

Recipe/ingredient photo upload (would need mocking the R2 presigned-PUT
flow itself, not just `get-upload-url`), the progress/weight-chart screen,
and the unit converter — none touch the parts of the architecture (auth,
onboarding, ownership model, offline sync) this suite is built to protect
first. Extending `mockBackend.ts` to cover more RPCs/tables as new features
land should be straightforward — it's a generic-enough PostgREST-alike that
most new reads/writes need no new mock code at all.
