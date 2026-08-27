import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAppStore } from '../../store/useAppStore';
import { useProfileNames } from '../profiles/useProfileNames';
import { fetchAllGroupLogEntries, fetchAllLogEntries } from './api';
import { EditLogEntryDialog } from './EditLogEntryDialog';
import { LogEntryCard } from './LogEntryCard';
import type { LogEntry } from '../../types/log';

// All-time history. `groupId: null` (the /logs route) is cross-context —
// everything the caller has logged, personal and every group combined (see
// fetchAllLogEntries). A group id (the /groups/:groupId/logs route, Ticket
// 12 follow-up) instead shows that one group's own shared history — every
// entry logged into it by any member, same scoping DailyLog's group branch
// already uses for "today." See docs/pending-deviations.md.
export function AllTimeLog({ groupId }: { groupId: string | null }) {
  const userId = useAppStore((state) => state.userId);

  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);

  // Reads from Dexie, not Supabase — re-renders automatically on
  // create/edit/delete (this device) and pulled remote changes alike.
  const entries = useLiveQuery(
    () => (groupId ? fetchAllGroupLogEntries(groupId) : userId ? fetchAllLogEntries(userId) : []),
    [userId, groupId],
  );
  const loading = entries === undefined;

  // Group context only — same reasoning as DailyLog's own `names` lookup.
  const names = useProfileNames(
    groupId ? (entries ?? []).flatMap((e) => [e.logged_for, e.created_by]) : [],
  );

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
          {groupId
            ? 'Nothing logged yet in this group. Entries logged here will show up.'
            : 'Nothing logged yet. Entries you log will show up here.'}
        </Typography>
      )}

      {groups.map(([date, dayEntries]) => {
        const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.kcal, 0);
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
                {dayTotal.toFixed(2)} kcal
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
                loggedForName={groupId && entry.logged_for !== userId ? names[entry.logged_for] : undefined}
                loggedByName={
                  groupId && entry.created_by !== entry.logged_for ? names[entry.created_by] : undefined
                }
                // See DailyLog's identical onClick comment — every entry
                // here is already something the update RLS lets the viewer
                // edit, group-inclusive since the "log for a group member"
                // rework.
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
