import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Fab from "@mui/material/Fab";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { useColorScheme } from "@mui/material/styles";
import { primaryAccent, shadows } from "../../theme/theme";
import { FloatingPortal } from "../../components/FloatingPortal";
import { GOAL_TYPES } from "../onboarding/onboardingOptions";
import {
  useMyProfile,
  useMyProfileLoadError,
  invalidateMyProfile,
} from "../profiles/useMyProfile";
import {
  useWeightLogs,
  useWeightLogsLoadError,
  invalidateWeightLogs,
  addWeightLog,
} from "./useWeightLogs";
import { daysAgoLocalDate } from "./api";
import {
  WEIGHT_CHART_RANGE_DAYS,
  DEFAULT_WEIGHT_CHART_RANGE_DAYS,
  type WeightChartRangeDays,
} from "./chartRanges";
import { EditGoalDialog } from "./EditGoalDialog";
import { LogWeightDialog } from "./LogWeightDialog";
import { WeightChart } from "./WeightChart";
import { BMI_CATEGORY_LABELS, calculateBmi, getBmiCategory } from "./bmi";

// Always personal, ignores active group context entirely — see routes.md
// ("/progress ignores the active group context entirely").
export function Progress({ userId }: { userId: string }) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;
  const chartColor =
    resolvedMode === "dark" ? primaryAccent.dark : primaryAccent.light;

  const profile = useMyProfile(userId);
  const profileError = useMyProfileLoadError(userId);
  const logs = useWeightLogs(userId);
  const logsError = useWeightLogsLoadError(userId);

  const [logOpen, setLogOpen] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [rangeDays, setRangeDays] = useState<WeightChartRangeDays>(
    DEFAULT_WEIGHT_CHART_RANGE_DAYS,
  );

  if (profileError || logsError) {
    return (
      <Box sx={{ p: 2, maxWidth: 480, mx: "auto" }}>
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                if (profileError) invalidateMyProfile();
                if (logsError) invalidateWeightLogs();
              }}
            >
              Try again
            </Button>
          }
        >
          Couldn't load your progress.
        </Alert>
      </Box>
    );
  }

  if (!profile || !logs) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const latestWeight = logs.length > 0 ? logs[logs.length - 1].weight_kg : null;
  const bmi =
    latestWeight !== null && profile.height_cm
      ? calculateBmi(latestWeight, profile.height_cm)
      : null;
  const goalTypeLabel = profile.goal_type
    ? GOAL_TYPES.find((g) => g.value === profile.goal_type)?.label
    : null;

  // Filters the already-fetched dataset (api.ts's fetch window covers the
  // widest selectable range) client-side rather than refetching per
  // dropdown selection. "Current weight" above intentionally keeps reading
  // from the full `logs`, not this filtered view, so narrowing the chart's
  // range never changes it.
  const today = daysAgoLocalDate(0);
  const rangeCutoff = daysAgoLocalDate(rangeDays);
  const chartLogs = logs.filter((log) => log.logged_at >= rangeCutoff);

  function handleRangeChange(event: SelectChangeEvent<number>) {
    setRangeDays(Number(event.target.value) as WeightChartRangeDays);
  }

  return (
    // Root box, not a nested wrapper — same FAB positioning reasoning as
    // DailyLog (fixed, wrapped in FloatingPortal so AnimatedAppShell's
    // transform doesn't hijack it).
    <Box sx={{ position: "relative", minHeight: "calc(100vh - 64px)" }}>
      <Stack spacing={1.5} sx={{ p: 2, maxWidth: 480, mx: "auto", pb: 18 }}>
        <Stack direction="row" spacing={1.5}>
          <Paper
            sx={{
              p: 2,
              borderRadius: "14px",
              boxShadow: tokens.sh2,
              textAlign: "center",
              flex: 1,
            }}
          >
            <Typography fontSize={24} fontWeight={500} color="primary.main">
              {latestWeight !== null ? latestWeight.toFixed(1) : "—"}
            </Typography>
            <Typography fontSize={12} color="text.secondary">
              current weight (kg)
            </Typography>
          </Paper>

          <Paper
            sx={{
              p: 2,
              borderRadius: "14px",
              boxShadow: tokens.sh2,
              textAlign: "center",
              flex: 1,
            }}
          >
            <Typography fontSize={24} fontWeight={500} color="primary.main">
              {bmi !== null ? bmi.toFixed(1) : "—"}
            </Typography>
            <Typography fontSize={12} color="text.secondary">
              BMI
              {bmi !== null
                ? ` · ${BMI_CATEGORY_LABELS[getBmiCategory(bmi)]}`
                : ""}
            </Typography>
          </Paper>
        </Stack>

        <Paper
          sx={{
            p: 2,
            borderRadius: "14px",
            boxShadow: tokens.sh2,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Stack spacing={0.25}>
            <Typography
              fontSize={14}
              color={goalTypeLabel ? "text.primary" : "text.secondary"}
            >
              {goalTypeLabel
                ? `Goal: ${goalTypeLabel}${profile.goal_weight_kg ? ` to ${profile.goal_weight_kg} kg` : ""}`
                : "No goal set"}
            </Typography>
            {profile.daily_kcal_target !== null && (
              <Typography fontSize={12} color="text.secondary">
                {profile.daily_kcal_target.toFixed(2)} kcal/day target
              </Typography>
            )}
          </Stack>
          <Button size="small" onClick={() => setGoalDialogOpen(true)}>
            {goalTypeLabel ? "Edit" : "Set goal"}
          </Button>
        </Paper>

        <Paper sx={{ p: 2, borderRadius: "14px", boxShadow: tokens.sh2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <Typography fontSize={14}>Weight trend</Typography>
            <Select
              value={rangeDays}
              onChange={handleRangeChange}
              variant="standard"
              disableUnderline
              size="small"
              sx={{ fontSize: 13 }}
              inputProps={{ "aria-label": "Weight trend range" }}
            >
              {WEIGHT_CHART_RANGE_DAYS.map((days) => (
                <MenuItem key={days} value={days} sx={{ fontSize: 13 }}>
                  {days} days
                </MenuItem>
              ))}
            </Select>
          </Stack>
          <WeightChart
            logs={chartLogs}
            color={chartColor}
            rangeStart={rangeCutoff}
            rangeEnd={today}
            emptyMessage={
              logs.length > 0 ? "No entries in this range." : undefined
            }
          />
        </Paper>
      </Stack>

      <FloatingPortal>
        <Fab
          color="primary"
          aria-label="Log weight"
          onClick={() => setLogOpen(true)}
          sx={{
            position: "fixed",
            right: 16,
            bottom: 80,
            boxShadow: (theme) =>
              theme.palette.mode === "dark"
                ? "0 6px 14px rgba(0,0,0,.5)"
                : "0 6px 14px rgba(93,110,1,.35)",
          }}
        >
          <AddIcon />
        </Fab>
      </FloatingPortal>

      <LogWeightDialog
        open={logOpen}
        userId={userId}
        onClose={() => setLogOpen(false)}
        onLogged={(log) => {
          addWeightLog(log);
          setLogOpen(false);
        }}
      />

      <EditGoalDialog
        open={goalDialogOpen}
        userId={userId}
        profile={profile}
        currentWeight={latestWeight}
        onClose={() => setGoalDialogOpen(false)}
        onSaved={() => setGoalDialogOpen(false)}
      />
    </Box>
  );
}
