# Routes

Living document. React Router, URL-based group context.

---

## Phase 1

```
/login
/signup
/onboarding                            # post-signup: height, weight, goal
/profile                               # account info, logout, theme toggle — reached via header avatar icon, not a bottom tab

/pantry                                # personal pantry
/pantry/:ingredientId

/recipes                               # personal recipes
/recipes/:recipeId

/log                                   # personal daily log
/logs                                  # all-time, cross-context: every entry the user has logged, personal + every group combined

/progress                              # weight/BMI trend + goal — always personal, ignores active group context entirely

/groups                                # list of groups the user belongs to, + "create group"
/groups/:groupId/settings              # owner-only: rename, description, manage members, delete
/groups/:groupId/pantry
/groups/:groupId/pantry/:ingredientId
/groups/:groupId/recipes
/groups/:groupId/recipes/:recipeId
/groups/:groupId/log                   # this group's shared daily log

/invite/:inviteCode                    # accept-invite landing page, calls accept_group_invite RPC
```

### Personal vs. group — why these aren't unified under one parameterized path

It's tempting to collapse `/pantry` and `/groups/:groupId/pantry` into a single `/context/:contextId/pantry` pattern for DRY-ness, but "personal" isn't an ID — it's the absence of one. Forcing it into the URL as a literal placeholder string is worse than having two route entries pointing at the same component:

```tsx
<Route path="/pantry" element={<PantryPage />} />
<Route path="/pantry/:ingredientId" element={<IngredientDetailPage />} />
<Route path="/groups/:groupId/pantry" element={<PantryPage />} />
<Route path="/groups/:groupId/pantry/:ingredientId" element={<IngredientDetailPage />} />
```

```tsx
function PantryPage() {
  const { groupId } = useParams(); // undefined on personal route, a uuid on group route
  const { data: ingredients } = useIngredients(groupId ?? null);
  // ...
}
```

Same component, same hook, same query logic — the route just determines which value flows in as `groupId`. This applies identically to Recipes and Log.

### `/logs` sits outside the `/groups/:groupId/` nesting deliberately

It's a cross-context view by definition — everything the user has logged, personal and every group combined — so it's a peer of `/pantry` and `/groups`, not a child of either. Query: `where logged_by = :userId` with no `group_id` filter.

### `/progress` ignores the active group context entirely

BMI and weight tracking are inherently personal (`profiles.height_cm`, `weight_logs`) — there's no such thing as a "group's BMI." Unlike Pantry/Recipes/Log, this screen shows identical content regardless of what's selected in the context switcher, so it's excluded from the switcher's scope even though it's a bottom-tab peer of the other three.

### `/invite/:inviteCode` is top-level, not nested under `/groups`

Needs to work for a logged-in user clicking a link from anywhere (e.g. opened from a messaging app), so it can't assume any prior navigation context.

### Navigation structure

Bottom tabs: **Pantry, Recipes, Log, Progress**. The context switcher (personal/group picker) applies to Pantry, Recipes, and Log only — switching context re-scopes the same four tabs' underlying data via the `groupId` param, it does not navigate to a different tab set. Progress is excluded from the switcher's effect (see above). Profile is not a tab — reached via a persistent header avatar icon across all four.

See design-system.md for the visual treatment of the context switcher and tab bar, and frontend-architecture.md for the push/pop vs. tab-switch animation rules tied to this route structure.
