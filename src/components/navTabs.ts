import type { ComponentType } from "react";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import KitchenIcon from "@mui/icons-material/Kitchen";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import EventNoteIcon from "@mui/icons-material/EventNote";
import InsightsIcon from "@mui/icons-material/Insights";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { useAppStore } from "../store/useAppStore";
import { useMyGroups } from "../features/groups/useMyGroups";
import { getStoredGroupId } from "../lib/activeGroupStorage";
import { resolveDefaultGroupId } from "../lib/defaultGroup";
import { getBottomTab, type BottomTab } from "../routes/navigationTransition";

// Shared tab config + group-resolution logic behind both BottomNav (<900px)
// and NavRail (>=900px) — see docs/pending-deviations.md ("Desktop nav
// shell (issue #62)"). Previously lived only in BottomNav.tsx (Ticket 16);
// factored out here once a second nav surface needed the exact same
// destinations/highlighting/tap-resolution behavior rather than a
// duplicated (and driftable) copy. Icons are kept as component references
// (not rendered JSX elements) specifically so this module can stay a plain
// `.ts` file — both callers render `<tab.icon />` themselves.
//
// Progress and Converter both ignore group context entirely (routes.md /
// pending-deviations.md "Converter tab"), so neither ever gets a
// /groups/:groupId prefix even while the other three are showing a group's
// content.
export interface NavTabConfig {
  key: BottomTab;
  label: string;
  icon: ComponentType<SvgIconProps>;
  // "always-group": no bare route exists for this tab (Pantry, Recipes, and
  // Log — its own bare, cross-context /log was removed, requested
  // directly), so tapping it always needs a real resolved group, even from
  // a screen with no :groupId of its own (Progress, Profile).
  // "context-free": Progress and Converter, never group-scoped.
  nav: "always-group" | "context-free";
}

export const TABS: NavTabConfig[] = [
  { key: "pantry", label: "Pantry", icon: KitchenIcon, nav: "always-group" },
  {
    key: "recipes",
    label: "Recipes",
    icon: MenuBookIcon,
    nav: "always-group",
  },
  { key: "log", label: "Log", icon: EventNoteIcon, nav: "always-group" },
  {
    key: "progress",
    label: "Progress",
    icon: InsightsIcon,
    nav: "context-free",
  },
  {
    key: "converter",
    label: "Converter",
    icon: SwapHorizIcon,
    nav: "context-free",
  },
];

// Width of the persistent left nav rail shown at >=md (see NavRail.tsx).
// Shared with AnimatedAppShell (to push main content right by this amount)
// and AppHeader (to start its fixed AppBar after the rail rather than
// overlapping it) so all three can never drift out of sync.
export const NAV_RAIL_WIDTH = 96;

// Shared controller for BottomNav/NavRail: which tab is active for the
// current route, and where tapping a given tab should navigate to.
// Identical resolution behavior to what BottomNav alone used to inline —
// see defaultGroup.ts/activeGroupStorage.ts for the fallback-group
// reasoning.
export function useNavTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>();
  const userId = useAppStore((state) => state.userId);
  const groups = useMyGroups(userId);

  const activeTab = getBottomTab(location.pathname);

  // Pantry/Recipes/Log tapped from Progress/Profile (none of which carry a
  // :groupId) need somewhere to land, same resolution the "/" redirect
  // uses. Null (nothing explicitly picked yet — see resolveDefaultGroupId)
  // falls through to the "else" branch in navigateToTab below, sending the
  // tap to /groups to choose instead of guessing one.
  const fallbackGroupId =
    routeGroupId ?? resolveDefaultGroupId(groups, getStoredGroupId());

  function navigateToTab(key: BottomTab) {
    const tab = TABS.find((candidate) => candidate.key === key);
    if (!tab) return;
    if (tab.nav === "context-free") {
      navigate(`/${tab.key}`);
    } else if (fallbackGroupId) {
      navigate(`/groups/${fallbackGroupId}/${tab.key}`);
    } else {
      navigate("/groups");
    }
  }

  return { tabs: TABS, activeTab, navigateToTab };
}
