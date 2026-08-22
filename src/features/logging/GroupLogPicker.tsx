import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GroupIcon from '@mui/icons-material/Group';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { useAppStore } from '../../store/useAppStore';
import { fetchMyGroups } from '../groups/api';
import type { GroupMembership } from '../../types/group';

// Replaces the old Log-screen context switcher (Ticket 12 follow-up, "/log
// shows everything") — /log itself is cross-context now, so viewing one
// group's own shared log is a deliberate pick from this list rather than an
// ambient chip. See docs/pending-deviations.md.
export function GroupLogPicker() {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const [groups, setGroups] = useState<GroupMembership[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetchMyGroups(userId)
      .then(setGroups)
      .catch(() => setError("Couldn't load your groups. Try again."));
  }, [userId]);

  const loading = groups === undefined && !error;

  return (
    <Stack spacing={1.5} sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
      <Typography fontSize={18} fontWeight={500}>
        Your groups
      </Typography>
      <Typography fontSize={13} color="text.secondary" sx={{ mt: -1 }}>
        Pick a group to see its own shared log.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && !error && groups?.length === 0 && (
        <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
          You're not in any groups yet. Join or create one to see a shared log here.
        </Typography>
      )}

      {(groups?.length ?? 0) > 0 && (
        <List sx={{ bgcolor: 'background.paper', borderRadius: '14px', boxShadow: tokens.sh2, py: 0 }}>
          {groups!.map((membership) => (
            <ListItemButton
              key={membership.group.id}
              onClick={() => navigate(`/groups/${membership.group.id}/log`)}
              sx={{ borderRadius: '14px' }}
            >
              <ListItemIcon>
                <GroupIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={membership.group.name} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Stack>
  );
}
