import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import { useAppStore } from '../../store/useAppStore';
import { fetchMyGroups } from './api';
import { GroupCard } from './GroupCard';
import { CreateGroupDialog } from './CreateGroupDialog';
import { InviteDialog } from './InviteDialog';
import type { GroupMembership } from '../../types/group';

export function GroupList() {
  const userId = useAppStore((state) => state.userId);

  const [groups, setGroups] = useState<GroupMembership[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<GroupMembership | null>(null);

  const loadGroups = useCallback(() => {
    if (!userId) return;
    setError(null);
    fetchMyGroups(userId)
      .then(setGroups)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Couldn't load your groups. Try again."),
      );
  }, [userId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const loading = groups === undefined && !error;

  return (
    // Root box, not a nested wrapper — see design-system.md's FAB positioning
    // note (same reasoning as RecipeList/PantryList).
    <Box sx={{ position: 'relative', minHeight: 'calc(100vh - 64px)' }}>
      <Stack spacing={1.5} sx={{ p: 2, maxWidth: 480, mx: 'auto', pb: 10 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && !error && groups?.length === 0 && (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            You're not in any groups yet. Create one to share a pantry, recipes, and a log with
            others.
          </Typography>
        )}

        {(groups ?? []).map((membership) => (
          <GroupCard
            key={membership.group.id}
            membership={membership}
            onInvite={() => setInviteTarget(membership)}
          />
        ))}
      </Stack>

      <Fab
        color="primary"
        aria-label="Create group"
        onClick={() => setCreateOpen(true)}
        sx={{
          position: 'fixed',
          right: 16,
          bottom: 24,
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 6px 14px rgba(0,0,0,.5)'
              : '0 6px 14px rgba(93,110,1,.35)',
        }}
      >
        <AddIcon />
      </Fab>

      <CreateGroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          loadGroups();
        }}
      />

      {inviteTarget && userId && (
        <InviteDialog
          open
          groupId={inviteTarget.group.id}
          groupName={inviteTarget.group.name}
          userId={userId}
          onClose={() => setInviteTarget(null)}
        />
      )}
    </Box>
  );
}
