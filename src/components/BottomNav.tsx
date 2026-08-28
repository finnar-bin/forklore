import type { ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import KitchenIcon from "@mui/icons-material/Kitchen";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import EventNoteIcon from "@mui/icons-material/EventNote";
import InsightsIcon from "@mui/icons-material/Insights";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../theme/theme";
import { useAppStore } from "../store/useAppStore";
import { useMyGroups } from "../features/groups/useMyGroups";
import { getStoredGroupId } from "../lib/activeGroupStorage";
import { resolveDefaultGroupId } from "../lib/defaultGroup";
import { getBottomTab, type BottomTab } from "../routes/navigationTransition";

// Bottom-tab bar — routes.md "Navigation structure" / design-system.md
// "Bottom navigation". No filled/pill background on the active tab; MUI's
// default BottomNavigationAction selected-color behavior (primary.main icon
// + label, muted text otherwise) already matches that on its own.
//
// Progress and Converter both ignore group context entirely (routes.md /
// pending-deviations.md "Converter tab"), so neither ever gets a
// /groups/:groupId prefix even while the other three are showing a group's
// content.
const TABS: Array<{
  key: BottomTab;
  label: string;
  icon: ReactNode;
  // "always-group": no bare route exists for this tab (Pantry, Recipes, and
  // now Log too — its own bare, cross-context /log was removed, requested
  // directly), so tapping it always needs a real resolved group, even from
  // a screen with no :groupId of its own (Progress, Profile).
  // "context-free": Progress, never group-scoped.
  nav: "always-group" | "context-free";
}> = [
  {
    key: "pantry",
    label: "Pantry",
    icon: <KitchenIcon />,
    nav: "always-group",
  },
  {
    key: "recipes",
    label: "Recipes",
    icon: <MenuBookIcon />,
    nav: "always-group",
  },
  { key: "log", label: "Log", icon: <EventNoteIcon />, nav: "always-group" },
  {
    key: "progress",
    label: "Progress",
    icon: <InsightsIcon />,
    nav: "context-free",
  },
  {
    key: "converter",
    label: "Converter",
    icon: <SwapHorizIcon />,
    nav: "context-free",
  },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>();
  const userId = useAppStore((state) => state.userId);
  const groups = useMyGroups(userId);
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  const activeTab = getBottomTab(location.pathname);

  // Pantry/Recipes/Log tapped from Progress/Profile (none of which carry a
  // :groupId) need somewhere to land, same resolution the "/" redirect
  // uses. Null (nothing explicitly picked yet — see resolveDefaultGroupId)
  // falls through to the `else` branch below, sending the tap to /groups to
  // choose instead of guessing one.
  const fallbackGroupId =
    routeGroupId ?? resolveDefaultGroupId(groups, getStoredGroupId());

  return (
    <BottomNavigation
      value={activeTab}
      onChange={(_event, value: BottomTab) => {
        const tab = TABS.find((candidate) => candidate.key === value);
        if (!tab) return;
        if (tab.nav === "context-free") {
          navigate(`/${tab.key}`);
        } else if (fallbackGroupId) {
          navigate(`/groups/${fallbackGroupId}/${tab.key}`);
        } else {
          navigate("/groups");
        }
      }}
      showLabels
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        borderTop: "1px solid",
        borderColor: "divider",
        boxShadow: tokens.sh1,
        bgcolor: "background.paper",
      }}
    >
      {TABS.map((tab) => (
        <BottomNavigationAction
          key={tab.key}
          label={tab.label}
          icon={tab.icon}
          value={tab.key}
        />
      ))}
    </BottomNavigation>
  );
}
