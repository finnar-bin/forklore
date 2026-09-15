import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { LineChart } from "@mui/x-charts/LineChart";
import type { WeightLog } from "../../types/weight";

export function WeightChart({
  logs,
  color,
  rangeStart,
  rangeEnd,
  emptyMessage = "Log your weight to start your trend.",
}: {
  logs: WeightLog[];
  // A plain CSS color string (e.g. theme/theme.ts's primaryAccent, resolved
  // for the current light/dark mode by the caller) — not a
  // `var(--mui-palette-*)` string, which this app's theme never actually
  // defines (see primaryAccent's own comment).
  color: string;
  // The selected range dropdown's boundaries (Progress.tsx's rangeCutoff and
  // today), as plain `YYYY-MM-DD` strings. Fixes the x-axis to span this
  // full window via explicit min/max — per direct feedback, narrowing to
  // e.g. 7 days must visibly narrow the axis even when the underlying data
  // doesn't reach both edges, not just re-space whatever points happen to
  // exist (which is all the prior point-scale axis did).
  rangeStart: string;
  rangeEnd: string;
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
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 220,
        }}
      >
        <Typography
          sx={{
            color: "text.secondary",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <LineChart
      dataset={logs.map((log) => ({
        date: parseLocalDate(log.logged_at),
        weight: log.weight_kg,
      }))}
      xAxis={[
        {
          dataKey: "date",
          // 'time' (real elapsed distance, explicit min/max), not 'point'
          // (one evenly-spaced slot per data point regardless of actual
          // date gaps) — a point scale can only ever span exactly as far as
          // the entries it's given, which is what made the range dropdown
          // look like it wasn't doing anything for a sparse dataset.
          scaleType: "time",
          min: parseLocalDate(rangeStart),
          max: parseLocalDate(rangeEnd),
          valueFormatter: (value) =>
            value.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
        },
      ]}
      // A fixed width plus an explicit formatter, rather than @mui/x-charts'
      // auto-sized/auto-formatted default, avoids a large left-side gap for
      // a near-flat trend line (a narrow or zero y-range — e.g. two logs at
      // the same weight, as reproduced while fixing this — makes the
      // auto-sizer both mis-estimate the label width and print extra
      // floating-point digits, which then got truncated with an ellipsis
      // anyway). One decimal matches Progress.tsx's own `latestWeight`/`bmi`
      // display convention.
      yAxis={[
        { width: 46, valueFormatter: (value: number) => value.toFixed(1) },
      ]}
      series={[{ dataKey: "weight", showMark: true, color }]}
      height={220}
      margin={{ left: 8, right: 16, top: 16, bottom: 30 }}
      grid={{ horizontal: true }}
    />
  );
}

// `logged_at`/the range boundaries are plain `date` strings (no time
// component) — parsed as their own local year/month/day rather than handed
// to `new Date(isoDate)` directly, which treats a bare "YYYY-MM-DD" string
// as UTC midnight and renders a day early in any timezone behind UTC (same
// reasoning as features/logging/api.ts's todayLocalDate).
function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}
