import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import CheckIcon from "@mui/icons-material/Check";
import SettingsIcon from "@mui/icons-material/Settings";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { setStoredGroupId } from "../lib/activeGroupStorage";
import { useMyGroups } from "../features/groups/useMyGroups";

// Mobile header's group switcher: pick a group in place (same effect as
// tapping its card on /groups) instead of navigating away first.
export function GroupSwitcherMenu({
  anchorEl,
  activeGroupId,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  activeGroupId: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const userId = useAppStore((state) => state.userId);
  const groups = useMyGroups(userId);

  return (
    <Menu anchorEl={anchorEl} open={anchorEl !== null} onClose={onClose}>
      {(groups ?? []).map(({ group }) => (
        <MenuItem
          key={group.id}
          selected={group.id === activeGroupId}
          onClick={() => {
            onClose();
            setStoredGroupId(group.id);
            navigate(`/groups/${group.id}/pantry`);
          }}
        >
          <ListItemIcon>
            {group.id === activeGroupId && <CheckIcon fontSize="small" />}
          </ListItemIcon>
          {group.name}
        </MenuItem>
      ))}
      <Divider />
      <MenuItem
        onClick={() => {
          onClose();
          navigate("/groups");
        }}
      >
        <ListItemIcon>
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        Manage groups
      </MenuItem>
    </Menu>
  );
}
