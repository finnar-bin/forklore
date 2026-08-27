import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import GroupIcon from "@mui/icons-material/Group";
import PersonIcon from "@mui/icons-material/Person";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../theme/theme";
import { useAppStore } from "../store/useAppStore";
import { useMyGroups } from "../features/groups/useMyGroups";
import { setStoredGroupId } from "../lib/activeGroupStorage";

// design-system.md "Context switcher chip" — pill-shaped, sits below the
// header on Pantry/Recipes screens (Progress ignores it — see routes.md; Log
// dropped it too, see this file's tab type note below). Personal vs. group
// is a route concern, not a Zustand one (see
// routes.md's own note on why /pantry and /groups/:groupId/pantry stay two
// route entries) — this component navigates between them directly rather
// than writing to useAppStore itself. It's the sole writer of the
// localStorage-backed "last group" (see activeGroupStorage.ts) — an
// explicit pick, group or Personal — so useSyncedActiveGroupId's
// restore-on-bare-route effect never fights a choice made here. That
// effect deliberately doesn't persist on its own passive re-renders
// (e.g. a still-mounted, mid-exit-animation group screen reacting to an
// unrelated useMyGroups update) — see its comment for why that used to
// resurrect a group right after picking Personal.
export function ContextSwitcher({
  tab,
  activeGroupId,
}: {
  // No 'log' here — the Log screen replaced this switcher with the
  // GroupLogPicker flow. See docs/pending-deviations.md (Ticket 12
  // follow-up, "/log shows everything").
  tab: "pantry" | "recipes";
  activeGroupId: string | null;
}) {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  // undefined = not yet fetched. Distinguished from "fetched, zero groups"
  // so the chip doesn't flash-and-disappear for a user who does belong to
  // groups but whose fetch just hasn't resolved yet. Shared across every
  // screen reading "groups I belong to" — see useMyGroups — rather than
  // this component's own independent fetch, since Ticket 16's BottomNav
  // means this mounts fresh on every Pantry<->Recipes tab switch.
  const groups = useMyGroups(userId);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const activeMembership = activeGroupId
    ? groups?.find((membership) => membership.group.id === activeGroupId)
    : null;
  const label = activeGroupId
    ? (activeMembership?.group.name ?? "Group")
    : "Personal";

  function openMenu(event: { currentTarget: HTMLElement }) {
    setAnchorEl(event.currentTarget);
  }

  function selectContext(groupId: string | null) {
    setAnchorEl(null);
    setStoredGroupId(groupId);
    navigate(groupId ? `/groups/${groupId}/${tab}` : `/${tab}`);
  }

  // Nothing to switch to — requested directly: a user in no groups at all
  // shouldn't see a picker whose only real option is the context they're
  // already in. Still renders (with whatever's loaded so far) if a group
  // route is actually active, even if the membership list hasn't resolved
  // yet or came back inconsistent, so there's always a way back to Personal.
  if (groups?.length === 0 && activeGroupId === null) {
    return null;
  }

  return (
    <Box sx={{ px: 2, pt: 1.5 }}>
      <Chip
        label={label}
        icon={
          activeGroupId ? (
            <GroupIcon fontSize="small" />
          ) : (
            <PersonIcon fontSize="small" />
          )
        }
        deleteIcon={<ArrowDropDownIcon />}
        onDelete={openMenu}
        onClick={openMenu}
        sx={{
          borderRadius: "999px",
          boxShadow: tokens.sh1,
          bgcolor: "background.paper",
        }}
      />
      <Menu
        anchorEl={anchorEl}
        open={anchorEl !== null}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem
          selected={activeGroupId === null}
          onClick={() => selectContext(null)}
        >
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Personal</ListItemText>
        </MenuItem>
        {(groups ?? []).map((membership) => (
          <MenuItem
            key={membership.group.id}
            selected={membership.group.id === activeGroupId}
            onClick={() => selectContext(membership.group.id)}
          >
            <ListItemIcon>
              <GroupIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{membership.group.name}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
