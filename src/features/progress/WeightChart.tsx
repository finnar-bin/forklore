import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { LineChart } from '@mui/x-charts/LineChart';
import type { WeightLog } from '../../types/weight';

export function WeightChart({
  logs,
  color,
  emptyMessage = 'Log your weight to start your trend.',
}: {
  logs: WeightLog[];
  // A plain CSS color string (e.g. theme/theme.ts's primaryAccent, resolved
  // for the current light/dark mode by the caller) — not a
  // `var(--mui-palette-*)` string, which this app's theme never actually
  // defines (see primaryAccent's own comment).
  color: string;
  // Overridable by Progress.tsx — a range filter (e.g. "7 days") narrowing
  // an otherwise non-empty history down to nothing needs a different
  // message ("no entries in this range") than a genuinely brand-new caller.
  emptyMessage?: string;
}) {
  // Only the true empty state falls back to text — a single entry still
  // renders as one visible marker (no line, since a line needs two points),
  // so logging the very first weight of a session visibly changes this
  // component rather than silently doing nothing. Height matches the
  // LineChart's own `height` below so the surrounding Paper doesn't reflow
  // when the second entry arrives.
  if (logs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 220 }}>
        <Typography color="text.secondary" fontSize={13} textAlign="center">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <LineChart
      dataset={logs.map((log) => ({ date: log.logged_at, weight: log.weight_kg }))}
      xAxis={[{ dataKey: 'date', scaleType: 'point', valueFormatter: (value) => formatShortDate(value) }]}
      series={[{ dataKey: 'weight', showMark: true, color }]}
      height={220}
      margin={{ left: 40, right: 16, top: 16, bottom: 30 }}
      grid={{ horizontal: true }}
    />
  );
}

// `logged_at` is a plain `date` column (no time component) — parsed as its
// own local year/month/day rather than handed to `new Date(isoDate)`
// directly, which treats a bare "YYYY-MM-DD" string as UTC midnight and
// renders a day early in any timezone behind UTC (same reasoning as
// features/logging/api.ts's todayLocalDate).
function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
