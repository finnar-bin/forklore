# Frontend architecture

Living document. Vite + React + TypeScript SPA — no server-side rendering, no Next.js. Chosen specifically to avoid navigation round-trips that would undermine the "feels native, no loading screens between navigations" requirement.

---

## Phase 1

### Stack

| Concern              | Choice                    | Notes                                                         |
| -------------------- | ------------------------- | ------------------------------------------------------------- |
| Build tool           | Vite                      | Static SPA output, deployed to Cloudflare Pages               |
| Language             | TypeScript                |                                                               |
| UI framework         | MUI v6                    | Themed to not look like default MUI — see design-system.md    |
| Routing              | React Router              | URL-based group context (see routes.md)                       |
| App state            | Zustand                   | Deliberately thin — session, active group, sync status only   |
| Local/offline data   | Dexie (IndexedDB wrapper) | Source of truth when offline                                  |
| Backend              | Supabase                  | Postgres, Auth, Edge Functions, RPC — see schema.md / rpcs.md |
| Photo storage        | Cloudflare R2             | Public bucket, not Supabase Storage — see schema.md           |
| Navigation animation | Framer Motion             | See "Navigation animation" section below                      |

**Why not Redux:** app-level state here is genuinely small (auth session, active group, sync status). Redux's strict action/reducer discipline pays off at a scale this app doesn't have. Zustand gives equivalent capability with far less boilerplate.

**Why not an Express/Fastify API layer:** RLS already enforces ownership checks for the bulk of CRUD operations at the database level — an application-layer server duplicating that same check would be redundant work, not added rigor. The exceptions (multi-table transactions, external API calls) are handled by Postgres RPC functions and Supabase Edge Functions respectively — see rpcs.md for the decision rule.

### Project structure

Feature-folder organization — grouped by domain concept, not strictly mirrored to routes. A "feature" often spans more than one route plus non-route logic (hooks, local state) that doesn't map to a single page.

```
src/
├── main.tsx
├── App.tsx                        # Router setup, AnimatePresence wrapper
├── theme/
│   └── theme.ts                    # Everforest MUI theme, light/dark colorSchemes
├── lib/
│   ├── supabase.ts                 # Supabase client init
│   └── db.ts                        # Dexie schema + instance
├── store/
│   ├── useAppStore.ts               # Zustand: session, active group context
│   └── useSyncStore.ts              # Zustand: sync status, last synced at
├── sync/
│   ├── outbox.ts                    # Enqueue/drain mutation queue, backoff + reconnect retry
│   └── pull.ts                      # Pull changes since last sync per table
├── types/
│   ├── ingredient.ts
│   ├── recipe.ts
│   ├── log.ts
│   ├── group.ts
│   ├── profile.ts
│   └── sync.ts
├── features/
│   ├── auth/
│   ├── onboarding/
│   ├── pantry/
│   ├── recipes/
│   ├── logging/
│   ├── groups/
│   └── progress/
├── components/                      # Shared across features (ExpandableListItem, PhotoUpload, etc.)
└── routes/                          # Route definitions, thin wrappers around feature components
```

**Types live in their own files, separated from business logic** — `src/types/` for anything that mirrors a DB table or is shared across more than one feature/store/Dexie definition. Purely local, non-reused types (e.g. a form's internal draft state) can stay colocated with the component as `ComponentName.types.ts`. Dexie table interfaces and Supabase query types should both import from `src/types/` rather than each redefining shape independently — one source of truth per entity shape.

### Dexie schema

Mirrors the Postgres tables in schema.md. Indexes are chosen specifically to support the sync engine's query patterns (pulling changes since a timestamp, draining the outbox in order).

```ts
import Dexie, { type EntityTable } from "dexie";
import type { Profile } from "../types/profile";
import type { Group } from "../types/group";
import type { Ingredient } from "../types/ingredient";
import type { Recipe } from "../types/recipe";
import type { LogEntry } from "../types/log";
import type { OutboxItem } from "../types/sync";

const db = new Dexie("calorie-app") as Dexie & {
  profiles: EntityTable<Profile, "id">;
  groups: EntityTable<Group, "id">;
  ingredients: EntityTable<Ingredient, "id">;
  recipes: EntityTable<Recipe, "id">;
  log_entries: EntityTable<LogEntry, "id">;
  outbox: EntityTable<OutboxItem, "id">;
};

db.version(1).stores({
  profiles: "id",
  groups: "id, owner_id",
  ingredients: "id, group_id, created_by, updated_at",
  recipes: "id, group_id, created_by, updated_at",
  log_entries: "id, group_id, logged_by, logged_at",
  outbox: "id, created_at",
});

export { db };
```

(Also stale — current Dexie schema is at `version(4)`, per `docs/pending-deviations.md`. `group_id` remains an index on all three tables, but is only ever nullable now for a community-flagged `ingredients` row; `recipes`/`log_entries` always have a real `group_id` once personal mode was removed. `log_entries`' index list uses `logged_for`/`created_by`, not `logged_by`.)

Reads go through `dexie-react-hooks`' `useLiveQuery` for automatic re-render on local data changes — not through RTK Query or manual polling.

### Zustand stores

Deliberately thin. Everything else (form state, list filters, expanded/collapsed UI state) stays local `useState` inside feature components — no reason to centralize that.

```ts
// useAppStore.ts — session + active group context
interface AppState {
  userId: string | null;
  activeGroupId: string | null; // null = personal context
  setSession: (userId: string | null) => void;
  setActiveGroup: (groupId: string | null) => void;
}
```

(Stale on two counts now, both explained in `docs/pending-deviations.md`: `activeGroupId`/`setActiveGroup` were removed in a Ticket 12 follow-up — see the logout-behavior note below — and "personal context" itself no longer exists as a concept at all once every account is required to belong to a group ("Remove personal mode"). The real `useAppStore` today only has `userId` and `onboardingComplete`.)

```ts
// useSyncStore.ts — sync status for UI feedback
interface SyncState {
  status: "idle" | "syncing" | "error";
  lastSyncedAt: string | null;
  setStatus: (status: SyncState["status"]) => void;
  setLastSynced: (timestamp: string) => void;
}
```

### Offline sync — outbox pattern

Local-first, not a CRDT-based sync engine (unwarranted complexity for a few trusted household members sharing data).

**Flow:**

1. Every read comes from Dexie.
2. Every write goes to Dexie immediately (optimistic UI) and is queued in the `outbox` table.
3. When online, a sync worker drains the outbox to Supabase.
4. Client periodically pulls `/sync`-equivalent changes (query tables `where updated_at > :lastSyncedAt`) and merges into Dexie.
5. Conflicts resolved by **last-write-wins** on `updated_at` — sufficient for small trusted groups, not a scenario requiring true conflict resolution UI.

**Retry behavior on outbox drain failure** — failures are split into two categories, handled differently:

- **Transient errors** (network timeout, momentary server blip): automatic retry with exponential backoff (1s, 2s, 4s, 8s, 16s, capped at 30s). After 5 attempts, stop actively retrying but mark the item `waiting_for_connectivity` rather than permanently failed — it gets automatically re-armed and retried the moment the browser's `online` event fires, with no user action needed.
- **Permanent errors** (RLS denial, validation failure): no retry — retrying an invalid mutation will fail identically every time. Surface immediately to the user as `failed`, distinct from `waiting_for_connectivity` in the UI, since one resolves itself and the other genuinely needs attention.

```ts
async function drainOutboxWithRetry(item: OutboxItem, attempt = 0) {
  try {
    await syncItem(item);
    await db.outbox.delete(item.id);
  } catch (err) {
    if (isPermanentError(err)) {
      await db.outbox.update(item.id, { status: "failed", error: err.message });
      useSyncStore.getState().setStatus("error");
      return;
    }
    if (attempt >= 5) {
      await db.outbox.update(item.id, { status: "waiting_for_connectivity" });
      return;
    }
    const delayMs = Math.min(1000 * 2 ** attempt, 30000);
    setTimeout(() => drainOutboxWithRetry(item, attempt + 1), delayMs);
  }
}

window.addEventListener("online", () => {
  db.outbox
    .where("status")
    .equals("waiting_for_connectivity")
    .toArray()
    .then((items) => items.forEach((item) => drainOutboxWithRetry(item, 0)));
});
```

### Logout behavior

Logging out **clears the entire local Dexie database** — forces a fresh sync on next login rather than risking a different user on the same device briefly seeing stale cached data.

**Unsynced changes at logout time:** if the outbox has pending items, do not block logout (that would trap an offline user who just wants to log out). Instead, show a warning naming the actual pending count ("You have 3 unsynced changes. Logging out now will discard them.") and let the user confirm or cancel.

(No `setActiveGroup` call below — that store field/setter was removed in a Ticket 12 follow-up once the sync engine started pulling every one of the caller's groups instead of just an "active" one; see `docs/pending-deviations.md`.)

```ts
async function attemptLogout() {
  const pendingCount = await db.outbox.count();
  if (pendingCount > 0) {
    return { needsConfirmation: true, pendingCount };
  }
  await performLogout();
  return { needsConfirmation: false };
}

async function performLogout() {
  await supabase.auth.signOut();
  await db.delete();
  useAppStore.getState().setSession(null);
}
```

### Navigation animation

Framer Motion, wrapping the router outlet in `AnimatePresence`. Two distinct transition styles based on navigation structure, not applied uniformly:

- **Push/pop** (navigating to/from a URL child, e.g. `/pantry` → `/pantry/:id`, or opening `/profile` from the header icon): slide in from the right on push, slide out to the right on pop — mimics native stack navigation.
- **Tab switch** (navigating between the four bottom-tab roots: Pantry/Recipes/Log/Progress): fade or instant swap, no directional slide — these are sibling views, not a stack.

The push/pop vs. tab-switch classification is derived from comparing route depth/structure between the previous and next path, not hardcoded per-route.

**Explicitly out of scope for Phase 1:** gesture-driven edge-swipe-to-go-back. Meaningfully more effort (gesture tracking, interrupting/resuming animations, syncing with router state) than tap-driven transitions — treat as a separate future enhancement, not something to bundle into Phase 1 tickets even if it seems like a natural extension.

```tsx
<AnimatePresence mode="wait" initial={false}>
  <motion.div
    key={location.pathname}
    initial={{ x: isPush ? 40 : 0, opacity: isPush ? 0 : 1 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: isPush ? -40 : 0, opacity: isPush ? 0 : 1 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
  >
    <Outlet />
  </motion.div>
</AnimatePresence>
```

### Photo handling

Compression and WebP conversion happen **client-side, before upload** — not server-side after. This keeps the direct-to-R2 presigned-upload flow intact (no server ever touches file bytes) and reduces data sent over the user's connection, relevant for a mobile-first app on potentially spotty data.

```ts
import imageCompression from "browser-image-compression";

async function prepareImageForUpload(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1024,
    fileType: "image/webp",
    useWebWorker: true,
  });
}
```

Single compressed size only in Phase 1 (no thumbnail variant) — a photo grid dense enough to need a separate thumbnail size doesn't exist until Phase 3's feed. Generating thumbnails then is a clean additive change (backfill job for existing photos), not something to build speculatively now.

Missing-photo state: a generic placeholder icon, not a per-category icon — see design-system.md.
