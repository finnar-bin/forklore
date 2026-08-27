import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Fab from "@mui/material/Fab";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../../theme/theme";
import { useAppStore } from "../../store/useAppStore";
import { FloatingPortal } from "../../components/FloatingPortal";
import { useProfileNames } from "../profiles/useProfileNames";
import { fetchTodayLogEntries } from "./api";
import { AddLogEntryDialog } from "./AddLogEntryDialog";
import { EditLogEntryDialog } from "./EditLogEntryDialog";
import { GroupMemberKcalCard } from "./GroupMemberKcalCard";
import { LogEntryCard } from "./LogEntryCard";
import { MEAL_TYPES, MEAL_TYPE_LABELS } from "../../types/meal";
import { getMealKcalTargets } from "../../types/profile";
import { useMyProfile } from "../profiles/useMyProfile";
import type { LogEntry } from "../../types/log";
import type { MealType } from "../../types/meal";

// Display order for categorizing today's entries — null (no meal picked)
// sorts last, after the four selectable meal types.
const MEAL_TYPE_SECTIONS: { key: MealType | null; label: string }[] = [
  ...MEAL_TYPES.map((key) => ({ key, label: MEAL_TYPE_LABELS[key] })),
  { key: null, label: "Uncategorized" },
];

export function DailyLog({
  groupId,
  groupName,
  hasGroups,
}: {
  groupId: string | null;
  // Resolved by LogPage (which already looks it up for the header title) so
  // this component doesn't duplicate that fetchMyGroups call — see
  // docs/pending-deviations.md (Ticket 12 follow-up, "group's all-time
  // history"). Only meaningful when groupId is set.
  groupName?: string | null;
  // Every account belongs to at least one group now (see
  // docs/pending-deviations.md, "Remove personal mode"), so this is really
  // just an initial-load guard: undefined while LogPage's own group-list
  // fetch is still in flight, treated the same as false so "View group
  // logs" pops in once it resolves rather than flashing on click-before-ready.
  hasGroups?: boolean;
}) {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  // Always the viewer's own preferences — the daily target and its
  // optional per-meal breakdown are personal, not group-wide, even on
  // /groups/:groupId/log (whichever group's log this is showing).
  const profile = useMyProfile(userId);
  const dailyKcalTarget = profile?.daily_kcal_target ?? null;
  const mealKcalTargets = profile ? getMealKcalTargets(profile) : null;

  const [addOpen, setAddOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);

  // Reads from Dexie, not Supabase — re-renders automatically on
  // create/edit/delete (this device) and pulled remote changes alike.
  const entries = useLiveQuery(
    () => (userId ? fetchTodayLogEntries(userId, groupId) : []),
    [userId, groupId],
  );
  const loading = entries === undefined;

  const totalKcal = (entries ?? []).reduce((sum, entry) => sum + entry.kcal, 0);

  // Group context only — see LogEntryCard's loggedForName prop and
  // docs/pending-deviations.md (Ticket 12 follow-up, "logged by" name, and
  // the later "log for a group member" rework).
  const names = useProfileNames(
    groupId ? (entries ?? []).map((e) => e.logged_for) : [],
  );

  return (
    // Root box, not a nested wrapper — see design-system.md's FAB positioning
    // note. The FAB itself uses position: fixed (anchored to the viewport),
    // not absolute — absolute anchored it to this box, which grows with the
    // list, pushing the FAB off-screen once the list got long. It's also
    // wrapped in FloatingPortal (Ticket 16) so AnimatedAppShell's animated
    // transform doesn't hijack its fixed positioning.
    <Box sx={{ position: "relative", minHeight: "calc(100vh - 64px)" }}>
      {/* pb clears both the FAB (bottom: 80) and BottomNav below it — see
          docs/pending-deviations.md (Ticket 16). */}
      <Stack spacing={1.5} sx={{ p: 2, maxWidth: 480, mx: "auto", pb: 18 }}>
        {groupId ? (
          // A daily target is personal, not group-wide — the group log's
          // info card shows every member's own target (and optional
          // per-meal breakdown) side by side instead of one aggregate
          // total that wouldn't clearly belong to anyone.
          <GroupMemberKcalCard
            groupId={groupId}
            userId={userId}
            entries={entries ?? []}
          />
        ) : (
          <Paper
            sx={{
              p: 2,
              borderRadius: "14px",
              boxShadow: tokens.sh2,
              textAlign: "center",
            }}
          >
            <Typography fontSize={24} fontWeight={500} color="primary.main">
              {dailyKcalTarget !== null
                ? `${totalKcal.toFixed(2)} / ${dailyKcalTarget.toFixed(2)}`
                : totalKcal.toFixed(2)}
            </Typography>
            <Typography fontSize={12} color="text.secondary">
              {dailyKcalTarget !== null
                ? "kcal logged vs. your daily target"
                : "kcal logged today"}
            </Typography>

            {profile?.meal_breakdown_enabled && mealKcalTargets && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Stack direction="row" justifyContent="space-around">
                  {MEAL_TYPES.map((meal) => {
                    const target = mealKcalTargets[meal] ?? 0;
                    // `?? null` guards a pre-feature row cached before
                    // meal_type existed — see MEAL_TYPE_SECTIONS' own
                    // identical guard below.
                    const consumed = (entries ?? [])
                      .filter((entry) => (entry.meal_type ?? null) === meal)
                      .reduce((sum, entry) => sum + entry.kcal, 0);
                    const remaining = target - consumed;
                    return (
                      <Stack key={meal} alignItems="center" spacing={0.25}>
                        <Typography fontSize={11} color="text.secondary">
                          {MEAL_TYPE_LABELS[meal]}
                        </Typography>
                        <Typography
                          fontSize={13}
                          fontWeight={500}
                          color={remaining < 0 ? "error.main" : undefined}
                        >
                          {remaining >= 0
                            ? `${remaining.toFixed(2)} left`
                            : `${Math.abs(remaining).toFixed(2)} over`}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </>
            )}
          </Paper>
        )}

        <Stack direction="row" spacing={1}>
          <Button
            onClick={() =>
              navigate(groupId ? `/groups/${groupId}/logs` : "/logs")
            }
            sx={{ flex: 1 }}
          >
            {groupId
              ? `View ${groupName ?? "group"}'s all-time history`
              : "View all-time history"}
          </Button>
          {groupId ? (
            <Button onClick={() => navigate("/log")} sx={{ flex: 1 }}>
              View log across all groups
            </Button>
          ) : (
            hasGroups && (
              <Button onClick={() => navigate("/logs/groups")} sx={{ flex: 1 }}>
                View group logs
              </Button>
            )
          )}
        </Stack>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && entries?.length === 0 && (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            {groupId
              ? "Nothing logged yet today in this group. Add the first entry to get started."
              : "Nothing logged yet today. Add your first entry to get started."}
          </Typography>
        )}

        {MEAL_TYPE_SECTIONS.map(({ key, label }) => {
          // `?? null` guards a row cached before this feature shipped —
          // never re-pulled since (pull.ts's cursor only re-fetches rows
          // past their updated_at), so meal_type is `undefined` at runtime
          // on such a row despite the `MealType | null` type, and would
          // otherwise match neither a real meal nor the "Uncategorized"
          // bucket under strict ===.
          const sectionEntries = (entries ?? []).filter(
            (entry) => (entry.meal_type ?? null) === key,
          );
          if (sectionEntries.length === 0) return null;
          return (
            <Stack key={label} spacing={1.5}>
              <Typography
                fontSize={13}
                fontWeight={600}
                color="text.secondary"
                sx={{ px: 0.5 }}
              >
                {label}
              </Typography>
              {sectionEntries.map((entry) => (
                <LogEntryCard
                  key={entry.id}
                  entry={entry}
                  subtitle={new Date(entry.created_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  loggedForName={groupId ? names[entry.logged_for] : undefined}
                  // Every entry surfaced by fetchTodayLogEntries is already
                  // something the update RLS lets the viewer edit — a
                  // personal one is always their own, and a group one is
                  // editable by any fellow member (docs/pending-deviations.md,
                  // "log for a group member" rework) — so this no longer
                  // needs an ownership gate the way it did when log_entries'
                  // update policy was owner-only.
                  onClick={() => setEditingEntry(entry)}
                />
              ))}
            </Stack>
          );
        })}
      </Stack>

      <FloatingPortal>
        <Fab
          color="primary"
          aria-label="Log an entry"
          onClick={() => setAddOpen(true)}
          sx={{
            position: "fixed",
            // Log is a bottom-tab root, so it clears BottomNav — see
            // docs/pending-deviations.md (Ticket 16).
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
