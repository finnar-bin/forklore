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

**Deviation (env/deploy tooling):** `schema.md`/`phase-1-tickets.md` don't specify how Supabase credentials should be configured or how migrations get pushed to a given environment. Added `.env.dev` / `.env.prod` (gitignored, with `.env.dev.example` / `.env.prod.example` templates committed) holding `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `SUPABASE_PROJECT_REF` per environment; Vite picks the right file via `--mode dev`/`--mode prod` (wired into `npm run dev` / `build` / `build:dev`); and two new npm commands, `supabase:push:dev` and `supabase:push:prod`, run `scripts/supabase-push.sh` to `supabase link` + `supabase db push` against the matching project. Auth for the CLI itself relies on a one-time interactive `npx supabase login` on the machine running the script, rather than a `SUPABASE_ACCESS_TOKEN` env var — kept simple since this is a single-developer setup today. **Why:** requested directly (not part of a numbered ticket) to give dev/prod Supabase projects a repeatable, one-command way to receive schema pushes. Not yet run against a live project for the same database-connection reason as above.
