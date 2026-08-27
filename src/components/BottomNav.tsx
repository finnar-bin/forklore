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
  groupAware: boolean;
}> = [
  { key: "pantry", label: "Pantry", icon: <KitchenIcon />, groupAware: true },
  {
    key: "recipes",
    label: "Recipes",
    icon: <MenuBookIcon />,
    groupAware: true,
  },
  { key: "log", label: "Log", icon: <EventNoteIcon />, groupAware: true },
  {
    key: "progress",
    label: "Progress",
    icon: <InsightsIcon />,
    groupAware: false,
  },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { groupId } = useParams<{ groupId?: string }>();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  const activeTab = getBottomTab(location.pathname);

  return (
    <BottomNavigation
      value={activeTab}
      onChange={(_event, value: BottomTab) => {
        const tab = TABS.find((candidate) => candidate.key === value);
        if (!tab) return;
        navigate(
          tab.groupAware && groupId
            ? `/groups/${groupId}/${tab.key}`
            : `/${tab.key}`,
        );
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
