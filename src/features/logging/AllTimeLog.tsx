import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAppStore } from '../../store/useAppStore';
import { fetchAllLogEntries } from './api';
import { LogEntryCard } from './LogEntryCard';
import type { LogEntry } from '../../types/log';

// All-time, cross-context history — see fetchAllLogEntries (queries by
// logged_by only, no group_id filter, by design per schema.md/routes.md).
export function AllTimeLog() {
  const userId = useAppStore((state) => state.userId);

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetchAllLogEntries(userId)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your log history.'))
      .finally(() => setLoading(false));
  }, [userId]);

  const groups = useMemo(() => {
    const byDate = new Map<string, LogEntry[]>();
    for (const entry of entries) {
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

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && groups.length === 0 && (
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
              />
            ))}
          </Stack>
        );
      })}
    </Stack>
  );
}
