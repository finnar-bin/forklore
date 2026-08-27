# Routes

Living document. React Router, URL-based group context.

---

## Phase 1

```
/login
/signup
/onboarding                            # post-signup: profile/goal steps, then a mandatory create-or-join-a-group step
/profile                               # account info, logout, theme toggle — reached via header avatar icon, not a bottom tab

/logs                                  # all-time, cross-context: every entry the user has logged, across every group they're in

/progress                              # weight/BMI trend + goal — always personal, ignores active group context entirely

/groups                                # list of groups the user belongs to, + "create group"
/groups/:groupId/settings              # owner-only: rename, description, manage members, delete
/groups/:groupId/pantry
/groups/:groupId/pantry/:ingredientId
/groups/:groupId/recipes
/groups/:groupId/recipes/:recipeId
/groups/:groupId/log                   # this group's shared daily log

/invite/:inviteCode                    # public — accept-invite landing page, calls accept_group_invite RPC
```

### Every account belongs to at least one group — no more personal routes

Pantry/Recipes/Log used to exist twice — a personal route (`/pantry`) and a group route (`/groups/:groupId/pantry`) pointing at the same component, with `groupId` from `useParams()` either `undefined` or a uuid. That duplication existed because "personal" (no group) was a valid state for an account to be in. It no longer is — onboarding now requires creating or joining a group before it completes (see `docs/pending-deviations.md`, "Remove personal mode") — so the personal routes are gone and `/groups/:groupId/...` is the only path to Pantry/Recipes/Log. `groupId` is a plain required route param now, no `?? null` fallback needed.

### `/logs` sits outside the `/groups/:groupId/` nesting deliberately

It's a cross-context view by definition — everything the user has logged, across every group they're in — so it's a peer of `/groups`, not a child of it. Query: `where logged_for = :userId` with no `group_id` filter.

### `/progress` ignores the active group context entirely

BMI and weight tracking are inherently personal (`profiles.height_cm`, `weight_logs`) — there's no such thing as a "group's BMI." This is the one screen that's still personal by design (see `docs/pending-deviations.md`, "Remove personal mode" for why it's explicitly out of scope) — unlike Pantry/Recipes/Log, it shows identical content regardless of which group is selected in the context switcher, so it's excluded from the switcher's scope even though it's a bottom-tab peer of the other three.

### `/invite/:inviteCode` is top-level, not nested under `/groups`, and public

Needs to work for a logged-in user clicking a link from anywhere (e.g. opened from a messaging app), so it can't assume any prior navigation context. It's also reachable while logged out — previewing an invite doesn't require membership, and a not-yet-signed-up invitee needs to land back here (not lose the code) after completing signup, so they join the group they were actually invited to rather than creating a redundant one during onboarding's group step. See `docs/pending-deviations.md`, "Remove personal mode."

### Navigation structure

Bottom tabs: **Pantry, Recipes, Log, Progress**. The context switcher (a group picker, once a user belongs to 2+ groups) applies to Pantry, Recipes, and Log only — switching context re-scopes the same four tabs' underlying data via the `groupId` param, it does not navigate to a different tab set. With exactly one group there's nothing to switch to, so the switcher hides itself. Progress is excluded from the switcher's effect (see above). Profile is not a tab — reached via a persistent header avatar icon across all four.

See design-system.md for the visual treatment of the context switcher and tab bar, and frontend-architecture.md for the push/pop vs. tab-switch animation rules tied to this route structure.
