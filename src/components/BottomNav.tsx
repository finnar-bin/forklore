import type { ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import KitchenIcon from "@mui/icons-material/Kitchen";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import EventNoteIcon from "@mui/icons-material/EventNote";
import InsightsIcon from "@mui/icons-material/Insights";
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
// Progress ignores group context entirely (routes.md), so it's the one tab
// that never gets a /groups/:groupId prefix even while the other three are
// showing a group's content.
const TABS: Array<{
  key: BottomTab;
  label: string;
  icon: ReactNode;
  // "always-group": no bare route exists anymore (Pantry/Recipes — see
  // docs/pending-deviations.md, "Remove personal mode"), so tapping it
  // always needs a real resolved group, even from a screen with no
  // :groupId of its own (Progress, Profile, bare /log).
  // "group-or-bare": Log kept a genuine bare, cross-context route
  // deliberately — this only follows the *current* route's own group (if
  // any), same as every tab did before "Remove personal mode"; it never
  // synthesizes a fallback group, so tapping Log from a non-group screen
  // still lands on the cross-context /log rather than forcing one group.
  // "context-free": Progress, never group-scoped.
  nav: "always-group" | "group-or-bare" | "context-free";
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
  { key: "log", label: "Log", icon: <EventNoteIcon />, nav: "group-or-bare" },
  {
    key: "progress",
    label: "Progress",
    icon: <InsightsIcon />,
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

  // Only Pantry/Recipes need this — tapping one from Progress/Profile
  // (neither carries a :groupId) needs a real group to land in, same
  // fallback the "/" redirect uses. Log's own "group-or-bare" nav never
  // consults this.
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
        } else if (tab.nav === "group-or-bare") {
          navigate(
            routeGroupId ? `/groups/${routeGroupId}/${tab.key}` : `/${tab.key}`,
          );
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
