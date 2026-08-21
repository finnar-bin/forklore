import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAppStore } from '../../store/useAppStore';
import { fetchAllLogEntries } from './api';
import { EditLogEntryDialog } from './EditLogEntryDialog';
import { LogEntryCard } from './LogEntryCard';
import type { LogEntry } from '../../types/log';

// All-time, cross-context history — see fetchAllLogEntries (queries by
// logged_by only, no group_id filter, by design per schema.md/routes.md).
export function AllTimeLog() {
  const userId = useAppStore((state) => state.userId);

  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);

  // Reads from Dexie, not Supabase — re-renders automatically on
  // create/edit/delete (this device) and pulled remote changes alike.
  const entries = useLiveQuery(() => (userId ? fetchAllLogEntries(userId) : []), [userId]);
  const loading = entries === undefined;

  const groups = useMemo(() => {
    const byDate = new Map<string, LogEntry[]>();
    for (const entry of entries ?? []) {
      const group = byDate.get(entry.logged_at);
      if (group) {
        group.push(entry);
      } else {
        byDate.set(entry.logged_at, [entry]);
      }
    }
    return Array.from(byDate.entries());
  }, [entries]);

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, mx: 'auto', pb: 4 }}>
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && groups.length === 0 && (
        <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
          Nothing logged yet. Entries you log will show up here.
        </Typography>
      )}

      {groups.map(([date, dayEntries]) => {
        const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.snapshot_kcal, 0);
        return (
          <Stack key={date} spacing={1.5}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography fontSize={13} fontWeight={500} color="text.secondary">
                {new Date(`${date}T00:00:00`).toLocaleDateString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Typography>
              <Typography fontSize={12} color="text.secondary">
                {dayTotal.toFixed(0)} kcal
              </Typography>
            </Box>
            {dayEntries.map((entry) => (
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
        );
      })}

      {editingEntry && (
        <EditLogEntryDialog
          open={editingEntry !== null}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={() => setEditingEntry(null)}
          onDeleted={() => setEditingEntry(null)}
        />
      )}
    </Stack>
  );
}
