import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../theme/theme';
import { useAppStore } from '../store/useAppStore';
import { fetchMyGroups } from '../features/groups/api';
import type { GroupMembership } from '../types/group';

// design-system.md "Context switcher chip" — pill-shaped, sits below the
// header on Pantry/Recipes/Log screens only (Progress ignores it — see
// routes.md). Personal vs. group is a route concern, not a Zustand one (see
// routes.md's own note on why /pantry and /groups/:groupId/pantry stay two
// route entries) — this component navigates between them directly rather
// than writing to useAppStore itself.
export function ContextSwitcher({
  tab,
  activeGroupId,
}: {
  tab: 'pantry' | 'recipes' | 'log';
  activeGroupId: string | null;
}) {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const [groups, setGroups] = useState<GroupMembership[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetchMyGroups(userId)
      .then(setGroups)
      .catch(() => setGroups([]));
  }, [userId]);

  const activeMembership = activeGroupId
    ? groups.find((membership) => membership.group.id === activeGroupId)
    : null;
  const label = activeGroupId ? (activeMembership?.group.name ?? 'Group') : 'Personal';

  function openMenu(event: { currentTarget: HTMLElement }) {
    setAnchorEl(event.currentTarget);
  }

  function selectContext(groupId: string | null) {
    setAnchorEl(null);
    navigate(groupId ? `/groups/${groupId}/${tab}` : `/${tab}`);
  }

  return (
    <Box sx={{ px: 2, pt: 1.5 }}>
      <Chip
        label={label}
        icon={activeGroupId ? <GroupIcon fontSize="small" /> : <PersonIcon fontSize="small" />}
        deleteIcon={<ArrowDropDownIcon />}
        onDelete={openMenu}
        onClick={openMenu}
        sx={{ borderRadius: '999px', boxShadow: tokens.sh1, bgcolor: 'background.paper' }}
      />
      <Menu
        anchorEl={anchorEl}
        open={anchorEl !== null}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem selected={activeGroupId === null} onClick={() => selectContext(null)}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Personal</ListItemText>
        </MenuItem>
        {groups.map((membership) => (
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
