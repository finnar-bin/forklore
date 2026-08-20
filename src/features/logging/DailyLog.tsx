import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
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
import { LogEntryCard } from './LogEntryCard';
import type { LogEntry } from '../../types/log';

export function DailyLog() {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchTodayLogEntries(userId)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load today's log."))
      .finally(() => setLoading(false));
  }, [userId]);

  const totalKcal = entries.reduce((sum, entry) => sum + entry.snapshot_kcal, 0);

  return (
    // FAB is anchored to this root box, not a nested wrapper — see the
    // positioning bug called out in design-system.md.
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

        {error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && entries.length === 0 && (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            Nothing logged yet today. Add your first entry to get started.
          </Typography>
        )}

        {entries.map((entry) => (
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

      <Fab
        color="primary"
        aria-label="Log an entry"
        onClick={() => setAddOpen(true)}
        sx={{
          position: 'absolute',
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
        onClose={() => setAddOpen(false)}
        onLogged={(created) => {
          setEntries((prev) => [created, ...prev]);
          setAddOpen(false);
        }}
      />
    </Box>
  );
}
