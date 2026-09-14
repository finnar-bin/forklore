import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../theme/theme";
import { TABS, useNavTabs } from "./navTabs";
import type { BottomTab } from "../routes/navigationTransition";

// Bottom-tab bar — routes.md "Navigation structure" / design-system.md
// "Bottom navigation". No filled/pill background on the active tab; MUI's
// default BottomNavigationAction selected-color behavior (primary.main icon
// + label, muted text otherwise) already matches that on its own. Shown at
// <900px only — NavRail.tsx is the >=900px equivalent, both driven by the
// same shared tab config/group-resolution logic in navTabs.ts. See
// docs/pending-deviations.md ("Desktop nav shell (issue #62)").
export function BottomNav() {
  const { activeTab, navigateToTab } = useNavTabs();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  return (
    <BottomNavigation
      value={activeTab}
      onChange={(_event, value: BottomTab) => navigateToTab(value)}
      showLabels
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: "calc(56px + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
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
          icon={<tab.icon />}
          value={tab.key}
        />
      ))}
    </BottomNavigation>
  );
}
