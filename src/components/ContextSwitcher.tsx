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
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../theme/theme";
import { useAppStore } from "../store/useAppStore";
import { useMyGroups } from "../features/groups/useMyGroups";
import { setStoredGroupId } from "../lib/activeGroupStorage";

// design-system.md "Context switcher chip" — pill-shaped, sits below the
// header on Pantry/Recipes screens (Progress ignores it — see routes.md; Log
// dropped it too, see this file's tab type note below). This component
// navigates between groups directly (a route concern, not a Zustand one —
// see routes.md) rather than writing to useAppStore itself. It's the sole
// writer of the localStorage-backed "last group" (see
// activeGroupStorage.ts), which BottomNav/the "/" redirect fall back to
// when landing on a screen with no :groupId of its own.
export function ContextSwitcher({
  tab,
  activeGroupId,
}: {
  // No 'log' here — the Log screen replaced this switcher with the
  // GroupLogPicker flow. See docs/pending-deviations.md (Ticket 12
  // follow-up, "/log shows everything").
  tab: "pantry" | "recipes";
  activeGroupId: string;
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

  const activeMembership = groups?.find(
    (membership) => membership.group.id === activeGroupId,
  );
  const label = activeMembership?.group.name ?? "Group";

  function openMenu(event: { currentTarget: HTMLElement }) {
    setAnchorEl(event.currentTarget);
  }

  function selectContext(groupId: string) {
    setAnchorEl(null);
    setStoredGroupId(groupId);
    navigate(`/groups/${groupId}/${tab}`);
  }

  // Nothing to switch to with only one group — every account has at least
  // one now (see docs/pending-deviations.md, "Remove personal mode"), so
  // this hides once there's genuinely no other option, mirroring its old
  // "hide with zero groups" behavior back when Personal was a real choice.
  // `groups === undefined` (still loading) deliberately does *not* hide it —
  // this is rendered from an active group route, so there's always at least
  // this one group; hiding here would just flash the chip away and back
  // once the fetch resolves for anyone who belongs to 2+.
  if (groups !== undefined && groups.length < 2) {
    return null;
  }

  return (
    <Box sx={{ px: 2, pt: 1.5 }}>
      <Chip
        label={label}
        icon={<GroupIcon fontSize="small" />}
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
