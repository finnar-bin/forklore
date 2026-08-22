import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { useAppStore } from '../../store/useAppStore';
import { fetchTodayLogEntries } from './api';
import { AddLogEntryDialog } from './AddLogEntryDialog';
import { EditLogEntryDialog } from './EditLogEntryDialog';
import { LogEntryCard } from './LogEntryCard';
import type { LogEntry } from '../../types/log';

export function DailyLog({ groupId }: { groupId: string | null }) {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const [addOpen, setAddOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);

  // Reads from Dexie, not Supabase — re-renders automatically on
  // create/edit/delete (this device) and pulled remote changes alike.
  const entries = useLiveQuery(
    () => (userId ? fetchTodayLogEntries(userId, groupId) : []),
    [userId, groupId],
  );
  const loading = entries === undefined;

  const totalKcal = (entries ?? []).reduce((sum, entry) => sum + entry.snapshot_kcal, 0);

  return (
    // Root box, not a nested wrapper — see design-system.md's FAB positioning
    // note. The FAB itself uses position: fixed (anchored to the viewport),
    // not absolute — absolute anchored it to this box, which grows with the
    // list, pushing the FAB off-screen once the list got long.
    <Box sx={{ position: 'relative', minHeight: 'calc(100vh - 64px)' }}>
      <Stack spacing={1.5} sx={{ p: 2, maxWidth: 480, mx: 'auto', pb: 10 }}>
        <Paper sx={{ p: 2, borderRadius: '14px', boxShadow: tokens.sh2, textAlign: 'center' }}>
          <Typography fontSize={24} fontWeight={500} color="primary.main">
            {totalKcal.toFixed(0)}
          </Typography>
          <Typography fontSize={12} color="text.secondary">
            kcal logged today
          </Typography>
        </Paper>

        <Button onClick={() => navigate('/logs')}>View all-time history</Button>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && entries?.length === 0 && (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            {groupId
              ? "Nothing logged yet today in this group. Add the first entry to get started."
              : 'Nothing logged yet today. Add your first entry to get started.'}
          </Typography>
        )}

        {(entries ?? []).map((entry) => (
          <LogEntryCard
            key={entry.id}
            entry={entry}
            subtitle={new Date(entry.created_at).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })}
            onClick={() => setEditingEntry(entry)}
          />
        ))}
      </Stack>

      <Fab
        color="primary"
        aria-label="Log an entry"
        onClick={() => setAddOpen(true)}
        sx={{
          position: 'fixed',
          right: 16,
          bottom: 24,
          boxShadow: (theme) =>
            theme.palette.mode === 'dark' ? '0 6px 14px rgba(0,0,0,.5)' : '0 6px 14px rgba(93,110,1,.35)',
        }}
      >
        <AddIcon />
      </Fab>

      <AddLogEntryDialog
        open={addOpen}
        groupId={groupId}
        onClose={() => setAddOpen(false)}
        onLogged={() => setAddOpen(false)}
      />

      {editingEntry && (
        <EditLogEntryDialog
          open={editingEntry !== null}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={() => setEditingEntry(null)}
          onDeleted={() => setEditingEntry(null)}
        />
      )}
    </Box>
  );
}
