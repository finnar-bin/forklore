import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../theme/theme";
import { NAV_RAIL_WIDTH, TABS, useNavTabs } from "./navTabs";

// Persistent left nav rail — the >=900px (md) equivalent of BottomNav,
// same 5 destinations and identical active-tab/group-resolution behavior
// (both driven by navTabs.ts's shared useNavTabs()/TABS). See
// docs/pending-deviations.md ("Desktop nav shell (issue #62)") for why this
// exists and the AppHeader/content-offset decisions that go with it.
//
// Rendered as a fixed, full-height column (not scoped to the tab-root
// screens the way BottomNav is) so it stays put across every screen this
// app has at md+, including detail screens, /profile, and /groups — "a
// persistent left nav rail," per the issue title, not a per-tab-root one.
export function NavRail() {
  const { activeTab, navigateToTab } = useNavTabs();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: NAV_RAIL_WIDTH,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 0.5,
        pt: 2,
        borderRight: "1px solid",
        borderColor: "divider",
        boxShadow: tokens.sh1,
        bgcolor: "background.paper",
        // Above the animated screen content (which sits in normal/absolute
        // flow with no explicit z-index of its own) so a mid-transition
        // screen can never slide over the rail; below FAB/notification
        // portals, which don't collide with it anyway (right- or
        // top-anchored — see FloatingPortal.tsx callers).
        zIndex: 1,
      }}
    >
      {TABS.map((tab) => {
        const selected = activeTab === tab.key;
        return (
          <ButtonBase
            key={tab.key}
            onClick={() => navigateToTab(tab.key)}
            aria-current={selected ? "page" : undefined}
            sx={{
              flexDirection: "column",
              gap: 0.5,
              py: 1.5,
              color: selected ? "primary.main" : "text.secondary",
            }}
          >
            <tab.icon />
            <Typography
              variant="caption"
              sx={{ color: "inherit", fontWeight: selected ? 600 : 400 }}
            >
              {tab.label}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
