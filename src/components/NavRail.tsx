import type { ComponentType } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import GroupIcon from "@mui/icons-material/Group";
import { useColorScheme, useTheme } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";
import { shadows } from "../theme/theme";
import {
  NAV_RAIL_WIDTH_COLLAPSED,
  NAV_RAIL_WIDTH_EXPANDED,
  TABS,
  useNavRailStore,
  useNavTabs,
} from "./navTabs";

function NavRailItem({
  icon: Icon,
  label,
  selected,
  collapsed,
  onClick,
}: {
  icon: ComponentType<SvgIconProps>;
  label: string;
  selected: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip
      title={label}
      placement="right"
      disableHoverListener={!collapsed}
      disableFocusListener={!collapsed}
      disableTouchListener={!collapsed}
    >
      <ListItemButton
        onClick={onClick}
        aria-label={label}
        aria-current={selected ? "page" : undefined}
        selected={selected}
        sx={{
          justifyContent: collapsed ? "center" : "flex-start",
          minHeight: 48,
          px: collapsed ? 2.5 : 3,
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            mr: collapsed ? 0 : 2,
            justifyContent: "center",
            color: selected ? "primary.main" : "text.secondary",
          }}
        >
          <Icon />
        </ListItemIcon>
        {!collapsed && (
          <ListItemText
            primary={label}
            slotProps={{
              primary: {
                sx: {
                  color: selected ? "primary.main" : "text.secondary",
                  fontWeight: selected ? 600 : 400,
                },
              },
            }}
          />
        )}
      </ListItemButton>
    </Tooltip>
  );
}

// Persistent left nav rail — the >=900px (md) equivalent of BottomNav,
// same 5 destinations and identical active-tab/group-resolution behavior
// (both driven by navTabs.ts's shared useNavTabs()/TABS). A standard
// collapsible MUI drawer (icon + label rows, a toggle to shrink to an
// icon-only rail) rather than a vertical rebuild of BottomNav's stacked
// icon-over-label layout — see docs/pending-deviations.md ("Collapsible
// desktop nav rail") for why, and for the AppHeader/content-offset
// decisions that go with it.
//
// Also carries a "Groups" item below the tab list (its own entry, not part
// of TABS — BottomNav/mobile keeps Groups as AppHeader's icon button
// unchanged, only the desktop rail moves it here) — see
// docs/pending-deviations.md ("Groups moves into the desktop nav rail").
//
// Rendered as a fixed, full-height column (not scoped to the tab-root
// screens the way BottomNav is) so it stays put across every screen this
// app has at md+, including detail screens, /profile, and /groups — "a
// persistent left nav rail," per issue #62, not a per-tab-root one.
export function NavRail() {
  const { activeTab, navigateToTab } = useNavTabs();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;
  const theme = useTheme();
  const collapsed = useNavRailStore((state) => state.collapsed);
  const toggleCollapsed = useNavRailStore((state) => state.toggleCollapsed);
  const width = collapsed ? NAV_RAIL_WIDTH_COLLAPSED : NAV_RAIL_WIDTH_EXPANDED;
  const navigate = useNavigate();
  const location = useLocation();
  const groupsSelected = location.pathname === "/groups";

  return (
    <Drawer
      variant="permanent"
      component="nav"
      aria-label="Main navigation"
      sx={{
        width,
        flexShrink: 0,
        // The docked root (this "nav" element) only contains a
        // position: fixed Paper below, which contributes nothing to its
        // own auto height — without an explicit height here, the nav
        // collapses to 0x0 and reads as invisible (e.g. to Playwright's
        // visibility check) despite the Paper rendering fine on top of it.
        height: "100vh",
        transition: theme.transitions.create("width", {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }}
      slotProps={{
        paper: {
          sx: {
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            width,
            overflowX: "hidden",
            borderRight: "1px solid",
            borderColor: "divider",
            boxShadow: tokens.sh1,
            bgcolor: "background.paper",
            transition: theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            // Above the animated screen content (which sits in normal/
            // absolute flow with no explicit z-index of its own) so a
            // mid-transition screen can never slide over the rail; below
            // FAB/notification portals, which don't collide with it anyway
            // (right- or top-anchored — see FloatingPortal.tsx callers).
            zIndex: 1,
          },
        },
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          gap: 1,
          minHeight: 64,
          px: collapsed ? 0 : 2,
          justifyContent: collapsed ? "center" : "space-between",
        }}
      >
        {!collapsed && (
          <Stack
            direction="row"
            sx={{ alignItems: "center", gap: 1, minWidth: 0 }}
          >
            <Box
              component="img"
              src="/icon.svg"
              alt=""
              sx={{ width: 32, height: 32, flexShrink: 0 }}
            />
            <Typography
              variant="h6"
              noWrap
              sx={{ fontWeight: 700, color: "text.primary" }}
            >
              Forklore
            </Typography>
          </Stack>
        )}
        <IconButton
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          size="small"
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Stack>
      <Divider />
      <List sx={{ py: 0 }}>
        {TABS.map((tab) => (
          <NavRailItem
            key={tab.key}
            icon={tab.icon}
            label={tab.label}
            selected={activeTab === tab.key}
            collapsed={collapsed}
            onClick={() => navigateToTab(tab.key)}
          />
        ))}
        <NavRailItem
          icon={GroupIcon}
          label="Groups"
          selected={groupsSelected}
          collapsed={collapsed}
          onClick={() => navigate("/groups")}
        />
      </List>
    </Drawer>
  );
}
