import { useLayoutEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SyncIcon from "@mui/icons-material/Sync";
import SyncProblemIcon from "@mui/icons-material/SyncProblem";
import GroupIcon from "@mui/icons-material/Group";
import { useColorScheme } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";
import { shadows } from "../theme/theme";
import { useAppStore } from "../store/useAppStore";
import { useSyncStore } from "../store/useSyncStore";
import { useMyProfile } from "../features/profiles/useMyProfile";
import { FloatingPortal } from "./FloatingPortal";
import { PhotoThumbnail } from "./PhotoThumbnail";
import { NAV_RAIL_WIDTH } from "./navTabs";
import { useIsOutgoingScreen } from "../routes/AnimatedAppShell";

// Sticky top bar for feature screens.
//
// Also doubles as the app's only entry point to /sync-status: a small icon
// appears only when there's something to say (syncing/error), tapping it
// navigates there — see docs/pending-deviations.md (Ticket 9).
//
// Also the app's only entry point to /groups (not a bottom tab per
// routes.md/design-system.md, and no nav bar exists yet regardless — Ticket
// 16). Same "would otherwise be unreachable except by typing the URL"
// reasoning as /sync-status above — see docs/pending-deviations.md (Ticket 11).
//
// Portaled out of AnimatedAppShell's animated motion.div (via FloatingPortal
// — same fix, same reasoning as that file's FABs) and switched from
// `position: sticky` to `position: fixed`, rather than left sticky inside
// it: on iOS Safari, a `position: sticky` (or `fixed`) descendant of a
// `transform`ed ancestor is pinned relative to that ancestor, not the real
// viewport, and empirically loses track of the correct offset entirely when
// the on-screen keyboard opens/closes and the visual viewport resizes out
// from under it — the reported "cut off/hidden" bug (unverified here, no iOS
// device available in this environment — see docs/pending-deviations.md).
// A spacer of the header's own measured height takes its place in normal
// flow so page content below still starts at the right offset. See
// docs/pending-deviations.md ("Issue #56", deviation 5).
//
// Only done for the screen AnimatedAppShell considers "current", though —
// see useIsOutgoingScreen. A screen mid-exit (both are mounted at once for
// the ~280ms transition) instead renders its AppBar the old way, inline
// with `position: sticky`, so it slides away with the rest of that screen's
// content exactly like before this portal existed, rather than competing
// with the incoming screen's portaled copy for the same fixed spot at the
// top of the real viewport — the "two overlapping headers" flash that was
// the alternative (docs/pending-deviations.md, "Issue #56" follow-up).
export function AppHeader({
  title,
  onBack,
}: {
  title: string;
  onBack?: () => void;
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;
  const navigate = useNavigate();
  const location = useLocation();
  const syncStatus = useSyncStore((state) => state.status);
  const userId = useAppStore((state) => state.userId);
  const profile = useMyProfile(userId);
  const isOutgoing = useIsOutgoingScreen();

  // Measured (not a hardcoded Toolbar height) so the in-flow spacer below
  // always matches exactly, regardless of viewport width (MUI's default
  // Toolbar is 56px on xs, 64px at sm+ — see theme.ts, which doesn't
  // override either) — same getBoundingClientRect + ResizeObserver pattern
  // as VirtualizedCardList's/VirtualizedSectionedCardList's own scrollMargin
  // measurement. Runs in useLayoutEffect (before paint) so the very first
  // real render already has the right spacer height, avoiding a one-frame
  // content jump under the now-fixed header. Skipped entirely while
  // `isOutgoing` — that render path doesn't portal/measure at all (see below).
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  useLayoutEffect(() => {
    if (isOutgoing) return;
    const el = headerRef.current;
    if (!el) return;
    const measure = () => {
      const height = el.getBoundingClientRect().height;
      setHeaderHeight((prev) => (prev === height ? prev : height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOutgoing]);

  const toolbarContent = (
    <Toolbar>
      {onBack && (
        <IconButton
          aria-label="Back"
          onClick={onBack}
          sx={{ mr: 1 }}
          edge="start"
        >
          <ArrowBackIcon />
        </IconButton>
      )}
      <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 500 }}>
        {title}
      </Typography>
      {location.pathname !== "/groups" && (
        <IconButton aria-label="Groups" onClick={() => navigate("/groups")}>
          <GroupIcon />
        </IconButton>
      )}
      {syncStatus !== "idle" && (
        <IconButton
          aria-label={
            syncStatus === "error" ? "Sync issue — view details" : "Syncing"
          }
          onClick={() => navigate("/sync-status")}
          color={syncStatus === "error" ? "error" : "default"}
        >
          {syncStatus === "error" ? (
            <SyncProblemIcon />
          ) : (
            <SyncIcon
              sx={{
                animation: "app-header-sync-spin 1.5s linear infinite",
                "@keyframes app-header-sync-spin": {
                  from: { transform: "rotate(0deg)" },
                  to: { transform: "rotate(360deg)" },
                },
              }}
            />
          )}
        </IconButton>
      )}
      {/* Persistent account-access icon, per design-system.md's "Profile/
      account access" pattern — edit profile, logout, and the theme
      toggle all live behind it now (Ticket 17), replacing the inline
      theme-toggle/logout buttons this header used before that screen
      existed (docs/pending-deviations.md, Ticket 6). */}
      {location.pathname !== "/profile" && (
        <IconButton
          aria-label="Profile"
          onClick={() => navigate("/profile")}
          sx={{ p: 0.5 }}
        >
          <PhotoThumbnail
            photoUrl={profile?.avatar_url ?? null}
            alt="Your avatar"
            size={32}
          />
        </IconButton>
      )}
    </Toolbar>
  );

  // Mid-exit copy: rendered inline, in normal flow, exactly like this
  // component's pre-#56 `position: sticky` shape — no portal, no fixed
  // positioning, no spacer — so it slides off with the rest of this
  // screen's content instead of sitting fixed atop the real viewport
  // alongside the incoming screen's own copy. See the file header comment.
  if (isOutgoing) {
    return (
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{ bgcolor: "background.paper", boxShadow: tokens.sh1 }}
      >
        {toolbarContent}
      </AppBar>
    );
  }

  return (
    <>
      {/* Reserves this header's own height in the normal document flow —
          see the file header comment for why the actual bar is portaled to
          `position: fixed` instead of rendering here directly. */}
      <Box aria-hidden sx={{ height: headerHeight }} />
      <FloatingPortal>
        <AppBar
          ref={headerRef}
          position="fixed"
          color="transparent"
          elevation={0}
          sx={{
            bgcolor: "background.paper",
            boxShadow: tokens.sh1,
            // Starts after NavRail's width at md+ rather than overlapping
            // or layering above it (an explicit choice, not a default —
            // see docs/pending-deviations.md, "Desktop nav shell (issue
            // #62)"): the rail is a separate, always-visible piece of
            // chrome, so the header should span only the content area to
            // its right, matching how the page content below it is already
            // offset (AnimatedAppShell.tsx).
            left: { xs: 0, md: NAV_RAIL_WIDTH },
            width: { xs: "100%", md: `calc(100% - ${NAV_RAIL_WIDTH}px)` },
          }}
        >
          {toolbarContent}
        </AppBar>
      </FloatingPortal>
    </>
  );
}
