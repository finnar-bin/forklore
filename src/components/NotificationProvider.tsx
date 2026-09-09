import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Snackbar from "@mui/material/Snackbar";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../theme/theme";

export interface NotifyOptions {
  message: string;
  // Rendered in the Snackbar's own `action` slot — e.g. UpdatePrompt.tsx's
  // "Reload"/dismiss buttons. Omitted for every plain toast (the other 8
  // migrated call sites).
  action?: ReactNode;
  // ms before auto-hiding, or null to stay open until `dismiss` is called or
  // the action/close closes it. Defaults to 3000 (every migrated call site's
  // own prior `autoHideDuration`) — UpdatePrompt.tsx's persistent "new
  // version available" prompt is the one call site that opts into null.
  autoHideDuration?: number | null;
}

interface QueuedNotification {
  key: number;
  message: string;
  action?: ReactNode;
  autoHideDuration: number | null;
}

interface NotificationContextValue {
  // Queues a toast (plain string, or NotifyOptions for an action/persistent
  // one) — see the component doc below for why this is a queue, not a
  // single `open` boolean. Returns the queued notification's key, so a
  // caller whose underlying condition can become false on its own
  // (UpdatePrompt.tsx's `needRefresh`) can later `dismiss` it.
  notify: (message: string | NotifyOptions) => number;
  // No-ops if `key` is no longer queued/current (already shown and
  // auto-hidden, or already dismissed) — safe to call unconditionally.
  dismiss: (key: number) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

const DEFAULT_AUTO_HIDE_MS = 3000;

// Header height (in the two Toolbar breakpoints MUI's default Toolbar uses —
// see theme.ts, which doesn't override either) plus a little breathing room,
// so the top-anchored Snackbar below never sits under/behind AppHeader's own
// now-fixed bar (see AppHeader.tsx) on any screen that renders one. A little
// generous on the handful of headerless screens (login/onboarding) that can
// still show one (UpdatePrompt's "new version available" toast is mounted
// at the true app root — see main.tsx — so it can fire on any of them) — a
// larger-than-necessary top gap there is a minor cosmetic tradeoff, not a
// collision, and far simpler than plumbing AppHeader's real measured height
// through a shared store for the rare screen that lacks one.
const TOP_OFFSET = {
  xs: "calc(56px + env(safe-area-inset-top, 0px) + 8px)",
  sm: "calc(64px + env(safe-area-inset-top, 0px) + 8px)",
};

// Centralized replacement for the ~9 separate local <Snackbar> usages this
// app used to have, one per save/copy/move success across RecipeDetail.tsx,
// IngredientDetail.tsx, GroupSettings.tsx, Profile.tsx, and UpdatePrompt.tsx
// — each owned its own `justX` boolean (or, for UpdatePrompt, the
// usePwaUpdateStore's `needRefresh`) bound straight to its own <Snackbar
// anchorOrigin="bottom">. See docs/pending-deviations.md ("Issue #56",
// deviation 4).
//
// Mounted once near the app root (main.tsx, wrapping both App and
// UpdatePrompt — see that file) so every caller shares one queue and one
// on-screen Snackbar, rather than each screen owning its own. Anchored top
// (not MUI's bottom default) — bottom is already occupied by this app's FABs
// (position: fixed, bottom: 80, FloatingPortal.tsx) and BottomNav, so a
// bottom-anchored toast would sit on top of/behind them on every list
// screen.
//
// Queued rather than a single `open` boolean: two notifications firing in
// quick succession (e.g. a save immediately followed by another action)
// would otherwise have the second silently replace the first mid-display, or
// MUI's own Snackbar would just extend the first's already-visible instance
// without ever showing the second's message at all. This instead mirrors
// MUI's own documented "consecutive snackbars" recipe — each queued item
// gets its own key, `current` holds its content until the *next* one is
// ready to take over, and `open` (not `current !== null`) drives the
// Snackbar's own `open` prop, closed via `onClose`/`dismiss` and only
// actually swapped out for the next queued item once its exit transition
// has genuinely finished (`slotProps.transition.onExited`) — not the moment
// `onClose` fires, which is *before* the exit transition plays out. Getting
// this backwards (promoting on `onClose` instead of `onExited`, as this
// used to) still queues and shows every message, in order, but the `key`
// change lands mid-exit and forces an abrupt remount instead of a smooth
// exit-then-enter handoff between two back-to-back notifications.
export function NotificationProvider({ children }: { children: ReactNode }) {
  // MUI's SnackbarContent defaults to a background inverted off
  // `background.default` (near-black in light mode, near-white in dark
  // mode) regardless of theme — a generic pill that ignores this app's
  // Everforest palette. Restyle it to the same card pattern used everywhere
  // else (background.paper, text.primary, 14px radius, sh2 shadow — see
  // GroupCard.tsx/Profile.tsx/etc.) so it reads as part of this app's theme.
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  const [queue, setQueue] = useState<QueuedNotification[]>([]);
  const [current, setCurrent] = useState<QueuedNotification | null>(null);
  const [open, setOpen] = useState(false);
  const nextKey = useRef(0);
  // Mirrors `current`, read synchronously inside `notify` (a stable, `[]`-dep
  // callback) below — see its own preemption comment for why.
  const currentRef = useRef<QueuedNotification | null>(null);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  // A persistent notification (autoHideDuration: null — currently only
  // UpdatePrompt.tsx's "new version available" prompt) that got preempted
  // by a transient one — see `notify`'s own comment below. Held here rather
  // than spliced back into `queue` itself so it can't jump ahead of a
  // *second* transient `notify()` call arriving in the same synchronous
  // tick as the first (queue mutations are async/batched, so re-deriving
  // "is something currently blocking" from `currentRef` on that second call
  // would still see the — not-yet-updated — persistent item and reorder
  // around it incorrectly).
  const pendingPersistentRef = useRef<QueuedNotification | null>(null);

  const notify = useCallback((message: string | NotifyOptions) => {
    const options: NotifyOptions =
      typeof message === "string" ? { message } : message;
    nextKey.current += 1;
    const key = nextKey.current;
    const item: QueuedNotification = {
      key,
      message: options.message,
      action: options.action,
      autoHideDuration:
        options.autoHideDuration === undefined
          ? DEFAULT_AUTO_HIDE_MS
          : options.autoHideDuration,
    };

    if (
      currentRef.current &&
      currentRef.current.autoHideDuration === null &&
      item.autoHideDuration !== null &&
      pendingPersistentRef.current === null
    ) {
      // A persistent notification would otherwise block every transient
      // notification queued after it indefinitely, since `current` never
      // goes back to null on its own. Preempt it: close it now and remember
      // it here so the promote-next effect below shows it again only once
      // every transient item queued in the meantime — this one included —
      // has had its turn, since its `key`/content are unchanged, so its
      // owner's own dismiss logic (UpdatePrompt.tsx's `shownKey` ref) keeps
      // working unmodified. The `pendingPersistentRef.current === null`
      // guard (rather than nulling `currentRef.current` here, which a
      // second `notify()` call in the same tick wouldn't see yet) is what
      // keeps a burst of several back-to-back `notify()` calls from each
      // independently "preempting" the same still-current persistent item.
      pendingPersistentRef.current = currentRef.current;
      setOpen(false);
    }
    setQueue((prev) => [...prev, item]);

    return key;
  }, []);

  // Only ever closes (`open: false`) the currently-showing item, by key —
  // it keeps `current`'s content in place so the exit transition has
  // something to animate out; `handleExited` below is what actually clears
  // it once that's done. A `key` still queued (not yet shown) is just
  // dropped from `queue` directly, nothing to animate; a key still pending
  // resurfacing after a preemption (see `notify`) is cleared from there too,
  // so a dismissed persistent notification doesn't pop back up later.
  const dismiss = useCallback(
    (key: number) => {
      setQueue((prev) => prev.filter((item) => item.key !== key));
      if (pendingPersistentRef.current?.key === key) {
        pendingPersistentRef.current = null;
      }
      if (current?.key === key) setOpen(false);
    },
    [current],
  );

  // Promotes the next queued item, or — once the queue's fully drained — a
  // preempted persistent notification waiting to resurface, only once
  // `current` has actually been cleared (by handleExited, once the previous
  // item's exit transition finished) — never while an item is merely
  // closing.
  useEffect(() => {
    if (current !== null) return;
    if (queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((prev) => prev.slice(1));
      setOpen(true);
    } else if (pendingPersistentRef.current !== null) {
      setCurrent(pendingPersistentRef.current);
      pendingPersistentRef.current = null;
      setOpen(true);
    }
  }, [current, queue]);

  function handleClose(key: number, reason?: string) {
    // Matches every migrated call site's original behavior — none of them
    // dismissed on an outside click either (MUI's Snackbar default already
    // ignores "clickaway" unless a caller opts out, so this just keeps that
    // default explicit).
    if (reason === "clickaway") return;
    if (current?.key === key) setOpen(false);
  }

  // Fires once the Snackbar's own exit transition (Grow/Fade, whichever the
  // theme uses) has actually finished playing, not when `open` merely flips
  // to false — see the component doc above.
  function handleExited() {
    setCurrent(null);
  }

  return (
    <NotificationContext.Provider value={{ notify, dismiss }}>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={current?.autoHideDuration ?? null}
        onClose={(_event, reason) => {
          if (current) handleClose(current.key, reason);
        }}
        slotProps={{
          transition: { onExited: handleExited },
          content: {
            sx: {
              bgcolor: "background.paper",
              color: "text.primary",
              borderRadius: "14px",
              boxShadow: tokens.sh2,
            },
          },
        }}
        message={current?.message}
        action={current?.action}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ top: TOP_OFFSET }}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotification must be used within a NotificationProvider.",
    );
  }
  return ctx;
}
