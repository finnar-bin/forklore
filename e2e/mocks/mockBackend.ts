import type { Page, Route } from "@playwright/test";
import { randomUUID } from "node:crypto";

// A minimal in-memory stand-in for a Supabase project (Auth + PostgREST +
// Edge Functions), installed via Playwright route interception. The app
// under test never learns the difference — it talks to
// `VITE_SUPABASE_URL` (see .env.test) exactly as it would a real project —
// but no request ever reaches a real network or database. This is what
// makes these e2e tests compatible with the "must not connect to
// databases" org policy while still exercising the real UI, real Dexie
// (IndexedDB), and real outbox/sync code paths. See e2e/README.md.

export type Row = Record<string, unknown>;

interface AuthUser {
  id: string;
  email: string;
  password: string;
}

const TABLES = [
  "profiles",
  "groups",
  "group_members",
  "group_invites",
  "ingredients",
  "recipes",
  "recipe_ingredients",
  "log_entries",
  "weight_logs",
] as const;
type TableName = (typeof TABLES)[number];

// Which timestamp columns each table actually has, per the
// supabase/migrations/20260819000000_phase1_schema.sql CREATE TABLE
// statements — not every table has both (group_members/recipe_ingredients
// have neither; profiles/groups/group_invites/weight_logs/log_entries have
// created_at only). Used instead of probing an existing row's shape, which
// guesses wrong (stamps both columns) for a table's very first insert when
// it's still empty.
const TIMESTAMP_COLUMNS: Record<
  TableName,
  { createdAt: boolean; updatedAt: boolean }
> = {
  profiles: { createdAt: true, updatedAt: false },
  groups: { createdAt: true, updatedAt: false },
  group_members: { createdAt: false, updatedAt: false },
  group_invites: { createdAt: true, updatedAt: false },
  ingredients: { createdAt: true, updatedAt: true },
  recipes: { createdAt: true, updatedAt: true },
  recipe_ingredients: { createdAt: false, updatedAt: false },
  log_entries: { createdAt: true, updatedAt: false },
  weight_logs: { createdAt: true, updatedAt: false },
};

function now(): string {
  return new Date().toISOString();
}

// Mirrors supabase/migrations/20260819000000_phase1_schema.sql's
// handle_new_user trigger — every auth user gets a profiles row for free.
function defaultProfile(user: AuthUser, name?: string): Row {
  return {
    id: user.id,
    name: name ?? user.email.split("@")[0],
    avatar_url: null,
    birthdate: null,
    sex: null,
    height_cm: null,
    activity_level: null,
    goal_weight_kg: null,
    goal_type: null,
    goal_pace: null,
    daily_kcal_target: null,
    meal_breakdown_enabled: false,
    breakfast_kcal_target: null,
    lunch_kcal_target: null,
    dinner_kcal_target: null,
    snack_kcal_target: null,
    created_at: now(),
  };
}

// The app's origin (localhost, served by vite) and the mock's fake API
// origin (VITE_SUPABASE_URL) differ, so the browser treats every request as
// cross-origin — including sending a real CORS preflight OPTIONS request,
// and enforcing Access-Control-Allow-* on every actual response, even
// though nothing here ever reaches a real network. Every response below
// (including error/empty ones) must carry these headers or the browser
// rejects it before the app ever sees it.
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "*",
};

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

function empty(route: Route, status: number) {
  return route.fulfill({ status, headers: CORS_HEADERS, body: "" });
}

// Single-relation embeds actually used by the app (features/groups/api.ts's
// `select("role, groups (*)")`) — enough to cover what's really queried,
// not a general PostgREST embedding engine.
const EMBEDS: Partial<
  Record<TableName, Record<string, { fk: string; table: TableName }>>
> = {
  group_members: { groups: { fk: "group_id", table: "groups" } },
  recipe_ingredients: {
    ingredients: { fk: "ingredient_id", table: "ingredients" },
  },
};

function parseFilterValue(
  op: string,
  raw: string,
): { op: string; value: unknown } {
  if (op === "in") {
    const inner = raw.replace(/^\(|\)$/g, "");
    return { op, value: inner.split(",").map((v) => v.trim()) };
  }
  return { op, value: raw };
}

function matches(
  row: Row,
  column: string,
  op: string,
  value: unknown,
): boolean {
  const cell = row[column];
  switch (op) {
    case "eq":
      // PostgREST params are always strings; row values may be numbers/
      // booleans/null — compare loosely via string coercion.
      return (
        cell !== null && cell !== undefined && String(cell) === String(value)
      );
    case "gt":
      return (
        cell !== null && cell !== undefined && String(cell) > String(value)
      );
    case "gte":
      return (
        cell !== null && cell !== undefined && String(cell) >= String(value)
      );
    case "lt":
      return (
        cell !== null && cell !== undefined && String(cell) < String(value)
      );
    case "lte":
      return (
        cell !== null && cell !== undefined && String(cell) <= String(value)
      );
    case "in":
      return Array.isArray(value) && value.map(String).includes(String(cell));
    default:
      return true;
  }
}

// Splits a PostgREST `select` param on top-level commas only, not ones
// inside an embed's own parens (e.g. `foo, bar (a, b)` -> ["foo", "bar (a, b)"]).
// Shared by `project()` and the embed handling in `handleRest` below.
function splitTopLevelSelect(select: string): string[] {
  return select
    .split(/,(?![^(]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function project(row: Row, select: string | null): Row {
  if (!select || select === "*") return row;
  const topLevel = splitTopLevelSelect(select);
  const plainCols = topLevel.filter((c) => !c.includes("("));
  if (plainCols.length === topLevel.length) {
    const out: Row = {};
    for (const col of plainCols) out[col] = row[col];
    return out;
  }
  return row; // embed handling happens in selectFromTable, which calls this only for plain cases
}

export class MockBackend {
  private tables: Record<TableName, Row[]> = {
    profiles: [],
    groups: [],
    group_members: [],
    group_invites: [],
    ingredients: [],
    recipes: [],
    recipe_ingredients: [],
    log_entries: [],
    weight_logs: [],
  };
  private usersByEmail = new Map<string, AuthUser>();
  private usersById = new Map<string, AuthUser>();
  private sessionUserByToken = new Map<string, string>();
  private userIdByRefreshToken = new Map<string, string>();
  private baseUrl: string;
  private offline = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  // ---- Seeding helpers (used by tests / fixtures) ----------------------

  seedUser(
    email: string,
    password: string,
    opts?: { name?: string; id?: string },
  ): AuthUser {
    const user: AuthUser = { id: opts?.id ?? randomUUID(), email, password };
    this.usersByEmail.set(email, user);
    this.usersById.set(user.id, user);
    this.tables.profiles.push(defaultProfile(user, opts?.name));
    return user;
  }

  completeProfile(userId: string, patch: Row): void {
    const profile = this.tables.profiles.find((p) => p.id === userId);
    if (profile) Object.assign(profile, patch);
  }

  seedGroup(input: {
    name: string;
    ownerId: string;
    description?: string | null;
    id?: string;
  }): Row {
    const group: Row = {
      id: input.id ?? randomUUID(),
      name: input.name,
      description: input.description ?? null,
      owner_id: input.ownerId,
      community_pantry_enabled: false,
      created_at: now(),
    };
    this.tables.groups.push(group);
    this.seedMembership(group.id as string, input.ownerId, "owner");
    return group;
  }

  seedMembership(
    groupId: string,
    userId: string,
    role: "owner" | "member" = "member",
  ): void {
    this.tables.group_members.push({
      group_id: groupId,
      user_id: userId,
      role,
      joined_at: now(),
    });
  }

  seedRow(table: TableName, row: Row): Row {
    const withDefaults: Row = {
      id: randomUUID(),
      created_at: now(),
      updated_at: now(),
      ...row,
    };
    this.tables[table].push(withDefaults);
    return withDefaults;
  }

  rows(table: TableName): Row[] {
    return this.tables[table];
  }

  // Simulates a dropped connection for outbox/sync purposes. A Playwright
  // `context.setOffline(true)` blocks *real* network traffic, but a request
  // this mock answers via `route.fulfill()` never reaches that layer at
  // all — it's resolved entirely inside Playwright's own interception, so
  // it would otherwise "succeed" regardless of offline state. Aborting the
  // route ourselves is what makes outbox.ts's retry/backoff path
  // (frontend-architecture.md) actually exercise-able in a test.
  setOffline(offline: boolean): void {
    this.offline = offline;
  }

  // ---- Installation ------------------------------------------------------

  async install(page: Page): Promise<void> {
    await page.route(`${this.baseUrl}/**`, (route) => {
      if (route.request().method() === "OPTIONS") return empty(route, 204);
      if (this.offline) return route.abort("internetdisconnected");
      const path = new URL(route.request().url()).pathname;
      if (path.includes("/auth/v1/")) return this.handleAuth(route);
      if (path.includes("/rest/v1/")) return this.handleRest(route);
      if (path.includes("/functions/v1/")) return this.handleFunctions(route);
      return empty(route, 404);
    });
  }

  // ---- Auth ---------------------------------------------------------------

  private sessionBody(user: AuthUser) {
    const token = randomUUID();
    this.sessionUserByToken.set(token, user.id);
    const refreshToken = randomUUID();
    this.userIdByRefreshToken.set(refreshToken, user.id);
    return {
      access_token: token,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: now(),
      },
    };
  }

  private async handleAuth(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice(
      url.pathname.indexOf("/auth/v1/") + "/auth/v1/".length,
    );
    const grantType = url.searchParams.get("grant_type");

    if (
      path === "token" &&
      grantType === "password" &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as {
        email: string;
        password: string;
      };
      const user = this.usersByEmail.get(body.email);
      if (!user || user.password !== body.password) {
        await json(route, 400, {
          error: "invalid_grant",
          error_description: "Invalid login credentials",
          msg: "Invalid login credentials",
        });
        return;
      }
      await json(route, 200, this.sessionBody(user));
      return;
    }

    if (
      path === "token" &&
      grantType === "refresh_token" &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON() as { refresh_token: string };
      // Looks up the user by the specific refresh token presented, not just
      // "any session that has ever existed" — several specs (e.g.
      // groups.spec.ts's invite flow) log a second, different user in
      // within the same test/backend instance, and a refresh must resolve
      // to whichever of them actually holds this token, not always the
      // first one ever issued.
      const userId = this.userIdByRefreshToken.get(body.refresh_token);
      const user = userId ? this.usersById.get(userId) : undefined;
      if (!user) {
        await json(route, 400, {
          error: "invalid_grant",
          error_description: "invalid refresh token",
        });
        return;
      }
      void body;
      await json(route, 200, this.sessionBody(user));
      return;
    }

    if (path === "signup" && request.method() === "POST") {
      const body = request.postDataJSON() as {
        email: string;
        password: string;
      };
      let user = this.usersByEmail.get(body.email);
      if (user) {
        await json(route, 400, {
          error: "user_already_exists",
          error_description: "User already registered",
        });
        return;
      }
      // A "+unconfirmed" local part simulates a project with email
      // confirmation required — sign-up succeeds with no session, matching
      // signUpWithEmail's `needsEmailConfirmation` branch (SignupForm.tsx).
      const needsConfirmation = body.email.includes("+unconfirmed");
      user = this.seedUser(body.email, body.password);
      if (needsConfirmation) {
        await json(route, 200, {
          id: user.id,
          email: user.email,
          confirmation_sent_at: now(),
        });
        return;
      }
      await json(route, 200, this.sessionBody(user));
      return;
    }

    if (path === "logout") {
      await empty(route, 204);
      return;
    }

    if (path === "user" && request.method() === "GET") {
      const auth = request.headers()["authorization"] ?? "";
      const token = auth.replace(/^Bearer\s+/i, "");
      const userId = this.sessionUserByToken.get(token);
      const user = userId ? this.usersById.get(userId) : undefined;
      if (!user) {
        await json(route, 401, { error: "unauthorized" });
        return;
      }
      await json(route, 200, this.sessionBody(user).user);
      return;
    }

    await empty(route, 404);
  }

  // ---- REST (PostgREST-alike) ---------------------------------------------

  private async handleRest(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());

    const rpcMatch = url.pathname.match(/\/rest\/v1\/rpc\/([^/?]+)/);
    if (rpcMatch) {
      const args = (request.postDataJSON() as Row) ?? {};
      await this.handleRpc(route, rpcMatch[1], args);
      return;
    }

    const table = url.pathname.slice(
      url.pathname.lastIndexOf("/") + 1,
    ) as TableName;
    if (!TABLES.includes(table)) {
      await empty(route, 404);
      return;
    }

    const wantsSingle = (request.headers()["accept"] ?? "").includes(
      "vnd.pgrst.object",
    );
    const preferHeader = request.headers()["prefer"] ?? "";
    const wantsRepresentation = preferHeader.includes("return=representation");

    const filters: Array<{ column: string; op: string; value: unknown }> = [];
    let select: string | null = null;
    // Multiple `.order()` calls (e.g. progress/api.ts's logged_at + created_at
    // tie-break) collapse into one comma-separated `order` param
    // (postgrest-js's TransformBuilder), not one param per column — parse
    // every entry, not just the first, or secondary sort columns silently
    // vanish.
    let order: Array<{ column: string; ascending: boolean }> = [];
    for (const [key, raw] of url.searchParams.entries()) {
      if (key === "select") {
        select = raw;
        continue;
      }
      if (key === "order") {
        order = raw.split(",").map((token) => {
          const [column, dir] = token.split(".");
          return { column, ascending: dir !== "desc" };
        });
        continue;
      }
      if (key === "limit" || key === "offset") continue;
      const dot = raw.indexOf(".");
      const op = dot === -1 ? "eq" : raw.slice(0, dot);
      const rawValue = dot === -1 ? raw : raw.slice(dot + 1);
      const parsed = parseFilterValue(op, rawValue);
      filters.push({ column: key, op: parsed.op, value: parsed.value });
    }

    const method = request.method();

    if (method === "GET") {
      let rows = this.tables[table].filter((row) =>
        filters.every((f) => matches(row, f.column, f.op, f.value)),
      );
      if (order.length > 0) {
        rows = [...rows].sort((a, b) => {
          for (const { column, ascending } of order) {
            const av = String(a[column] ?? "");
            const bv = String(b[column] ?? "");
            const cmp = av.localeCompare(bv);
            if (cmp !== 0) return ascending ? cmp : -cmp;
          }
          return 0;
        });
      }

      const embed = EMBEDS[table];
      const embeddedRelation = embed
        ? Object.keys(embed).find(
            (rel) =>
              select?.includes(`${rel} (`) || select?.includes(`${rel}(`),
          )
        : undefined;

      let payload: unknown[] = rows;
      if (embeddedRelation && embed) {
        const { fk, table: relTable } = embed[embeddedRelation];
        const plainCols = splitTopLevelSelect(select ?? "").filter(
          (c) => !c.includes("("),
        );
        payload = rows.map((row) => {
          const related = this.tables[relTable].find((r) => r.id === row[fk]);
          const base: Row = plainCols.length
            ? plainCols.reduce<Row>(
                (acc, col) => ({ ...acc, [col]: row[col] }),
                {},
              )
            : { ...row };
          base[embeddedRelation] = related ?? null;
          return base;
        });
      } else if (select && select !== "*") {
        payload = rows.map((row) => project(row, select));
      }

      if (wantsSingle) {
        if (payload.length !== 1) {
          await json(route, payload.length === 0 ? 406 : 409, {
            message:
              payload.length === 0 ? "No rows found" : "Multiple rows found",
          });
          return;
        }
        await json(route, 200, payload[0]);
        return;
      }
      await json(route, 200, payload);
      return;
    }

    if (method === "POST") {
      const body = request.postDataJSON();
      const inputRows: Row[] = Array.isArray(body) ? body : [body];
      const inserted = inputRows.map((r) => {
        const row: Row = { id: randomUUID(), ...r };
        if (TIMESTAMP_COLUMNS[table].createdAt)
          row.created_at = row.created_at ?? now();
        if (TIMESTAMP_COLUMNS[table].updatedAt)
          row.updated_at = row.updated_at ?? now();
        if (table === "group_invites") {
          row.invite_code = row.invite_code ?? randomUUID().slice(0, 8);
          row.expires_at =
            row.expires_at ??
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          row.accepted_by = row.accepted_by ?? null;
          row.accepted_at = row.accepted_at ?? null;
        }
        this.tables[table].push(row);
        return row;
      });
      if (table === "recipe_ingredients") {
        for (const row of inserted)
          this.recalculateRecipeKcal(row.recipe_id as string);
      }
      if (!wantsRepresentation) {
        await empty(route, 201);
        return;
      }
      await json(route, 201, wantsSingle ? inserted[0] : inserted);
      return;
    }

    if (method === "PATCH") {
      const body = request.postDataJSON() as Row;
      const updated: Row[] = [];
      this.tables[table] = this.tables[table].map((row) => {
        if (!filters.every((f) => matches(row, f.column, f.op, f.value)))
          return row;
        const next = { ...row, ...body };
        if ("updated_at" in row) next.updated_at = now();
        updated.push(next);
        return next;
      });
      if (table === "recipe_ingredients") {
        for (const row of updated)
          this.recalculateRecipeKcal(row.recipe_id as string);
      }
      if (!wantsRepresentation) {
        await empty(route, 204);
        return;
      }
      await json(route, 200, wantsSingle ? (updated[0] ?? null) : updated);
      return;
    }

    if (method === "DELETE") {
      const remaining: Row[] = [];
      const deleted: Row[] = [];
      for (const row of this.tables[table]) {
        if (filters.every((f) => matches(row, f.column, f.op, f.value)))
          deleted.push(row);
        else remaining.push(row);
      }
      this.tables[table] = remaining;
      if (table === "recipe_ingredients") {
        for (const row of deleted)
          this.recalculateRecipeKcal(row.recipe_id as string);
      }
      if (!wantsRepresentation) {
        await empty(route, 204);
        return;
      }
      await json(route, 200, wantsSingle ? (deleted[0] ?? null) : deleted);
      return;
    }

    await empty(route, 405);
  }

  // Mirrors supabase/migrations/20260819000000_phase1_schema.sql's
  // recalculate_recipe_kcal trigger — fires after every recipe_ingredients
  // insert/update/delete so `total_kcal` reflects the same
  // sum(i.kcal * ri.quantity_used / i.quantity) formula the real trigger
  // computes, keeping refreshRecipeFromServer's read consistent.
  private recalculateRecipeKcal(recipeId: string): void {
    const links = this.tables.recipe_ingredients.filter(
      (ri) => ri.recipe_id === recipeId,
    );
    const total = links.reduce((sum, ri) => {
      const ingredient = this.tables.ingredients.find(
        (i) => i.id === ri.ingredient_id,
      );
      if (!ingredient) return sum;
      const quantity = Number(ingredient.quantity) || 0;
      if (quantity === 0) return sum;
      return (
        sum + (Number(ingredient.kcal) * Number(ri.quantity_used)) / quantity
      );
    }, 0);
    const recipe = this.tables.recipes.find((r) => r.id === recipeId);
    if (recipe) {
      recipe.total_kcal = total;
      recipe.updated_at = now();
    }
  }

  // ---- RPCs -----------------------------------------------------------------

  private async handleRpc(
    route: Route,
    name: string,
    args: Row,
  ): Promise<void> {
    switch (name) {
      case "complete_onboarding": {
        const userId = this.currentUserIdFromAuth(route);
        if (!userId) {
          await json(route, 401, { message: "not authenticated" });
          return;
        }
        this.completeProfile(userId, {
          name: args.p_name,
          birthdate: args.p_birthdate,
          sex: args.p_sex,
          height_cm: args.p_height_cm,
          activity_level: args.p_activity_level,
          goal_type: args.p_goal_type,
          goal_weight_kg: args.p_goal_weight_kg,
          goal_pace: args.p_goal_pace,
          daily_kcal_target: args.p_daily_kcal_target,
          meal_breakdown_enabled: args.p_meal_breakdown_enabled,
          breakfast_kcal_target: args.p_breakfast_kcal_target,
          lunch_kcal_target: args.p_lunch_kcal_target,
          dinner_kcal_target: args.p_dinner_kcal_target,
          snack_kcal_target: args.p_snack_kcal_target,
        });
        this.tables.weight_logs.push({
          id: randomUUID(),
          user_id: userId,
          weight_kg: args.p_weight_kg,
          logged_at: now(),
          created_at: now(),
        });
        await json(route, 200, null);
        return;
      }
      case "create_group": {
        const userId = this.currentUserIdFromAuth(route);
        if (!userId) {
          await json(route, 401, { message: "not authenticated" });
          return;
        }
        const group = this.seedGroup({
          name: args.p_name as string,
          description: (args.p_description as string | null) ?? null,
          ownerId: userId,
        });
        await json(route, 200, group);
        return;
      }
      case "preview_group_invite": {
        const invite = this.tables.group_invites.find(
          (i) => i.invite_code === args.p_invite_code && !i.accepted_by,
        );
        if (!invite) {
          await json(route, 200, []);
          return;
        }
        const group = this.tables.groups.find((g) => g.id === invite.group_id);
        await json(route, 200, [
          { group_id: invite.group_id, group_name: group?.name ?? "" },
        ]);
        return;
      }
      case "accept_group_invite": {
        const userId = this.currentUserIdFromAuth(route);
        if (!userId) {
          await json(route, 401, { message: "not authenticated" });
          return;
        }
        const invite = this.tables.group_invites.find(
          (i) => i.invite_code === args.p_invite_code && !i.accepted_by,
        );
        if (!invite) {
          await json(route, 400, {
            message: "Invalid or expired invite code.",
          });
          return;
        }
        invite.accepted_by = userId;
        invite.accepted_at = now();
        this.seedMembership(invite.group_id as string, userId, "member");
        await json(route, 200, invite.group_id);
        return;
      }
      case "copy_ingredient": {
        const source = this.tables.ingredients.find(
          (i) => i.id === args.p_ingredient_id,
        );
        if (!source) {
          await json(route, 400, { message: "Ingredient not found." });
          return;
        }
        const copy = this.seedRow("ingredients", {
          ...source,
          id: randomUUID(),
          group_id: args.p_target_group_id,
          is_community: false,
        });
        await json(route, 200, copy.id);
        return;
      }
      case "find_ingredient_match": {
        const match = this.tables.ingredients.find(
          (i) =>
            i.group_id === args.p_target_group_id &&
            i.name === args.p_name &&
            i.unit === args.p_unit,
        );
        await json(route, 200, match ? [match] : []);
        return;
      }
      case "copy_recipe": {
        const source = this.tables.recipes.find(
          (r) => r.id === args.p_recipe_id,
        );
        if (!source) {
          await json(route, 400, { message: "Recipe not found." });
          return;
        }
        const copy = this.seedRow("recipes", {
          ...source,
          id: randomUUID(),
          group_id: args.p_target_group_id,
          forked_from_recipe_id: source.id,
        });
        // Mirrors the real RPC (supabase/migrations/
        // 20260903000000_copy_ingredient_recipe_rpcs.sql): it also carries
        // over every recipe_ingredients link, reusing a resolution's
        // use_existing_id when given or else copying the source ingredient
        // into the target context — not just the bare recipe row.
        const resolutions = Array.isArray(args.p_ingredient_resolutions)
          ? (args.p_ingredient_resolutions as Row[])
          : [];
        const links = this.tables.recipe_ingredients.filter(
          (ri) => ri.recipe_id === source.id,
        );
        for (const link of links) {
          const resolution = resolutions.find(
            (r) => r.source_ingredient_id === link.ingredient_id,
          );
          let targetIngredientId = resolution?.use_existing_id as
            string | undefined | null;
          if (!targetIngredientId) {
            const sourceIngredient = this.tables.ingredients.find(
              (i) => i.id === link.ingredient_id,
            );
            const newIngredient = this.seedRow("ingredients", {
              ...sourceIngredient,
              id: randomUUID(),
              group_id: args.p_target_group_id,
              is_community: false,
            });
            targetIngredientId = newIngredient.id as string;
          }
          this.tables.recipe_ingredients.push({
            recipe_id: copy.id,
            ingredient_id: targetIngredientId,
            quantity_used: link.quantity_used,
          });
        }
        if (links.length > 0) this.recalculateRecipeKcal(copy.id as string);
        await json(route, 200, copy.id);
        return;
      }
      case "check_ingredient_usage": {
        const uses = this.tables.recipe_ingredients
          .filter((ri) => ri.ingredient_id === args.p_ingredient_id)
          .map((ri) => {
            const recipe = this.tables.recipes.find(
              (r) => r.id === ri.recipe_id,
            );
            return recipe
              ? { recipe_id: recipe.id, recipe_name: recipe.name }
              : null;
          })
          .filter(Boolean);
        await json(route, 200, uses);
        return;
      }
      case "check_community_ingredient_usage": {
        const count = this.tables.recipe_ingredients.filter(
          (ri) => ri.ingredient_id === args.p_ingredient_id,
        ).length;
        await json(route, 200, count);
        return;
      }
      default:
        await json(route, 404, {
          message: `Mock RPC not implemented: ${name}`,
        });
    }
  }

  private currentUserIdFromAuth(route: Route): string | null {
    const auth = route.request().headers()["authorization"] ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    return this.sessionUserByToken.get(token) ?? null;
  }

  // ---- Edge Functions -------------------------------------------------------

  private async handleFunctions(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const name = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
    if (name === "get-upload-url") {
      await json(route, 200, {
        uploadUrl: `${this.baseUrl}/mock-upload/${randomUUID()}`,
        publicUrl: `${this.baseUrl}/mock-public/${randomUUID()}.webp`,
      });
      return;
    }
    if (name === "delete-photo") {
      await json(route, 200, { ok: true });
      return;
    }
    await empty(route, 404);
  }
}
