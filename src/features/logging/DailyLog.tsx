import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Fab from "@mui/material/Fab";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { useAppStore } from "../../store/useAppStore";
import { FloatingPortal } from "../../components/FloatingPortal";
import { useProfileNames } from "../profiles/useProfileNames";
import { fetchTodayLogEntries } from "./api";
import { AddLogEntryDialog } from "./AddLogEntryDialog";
import { EditLogEntryDialog } from "./EditLogEntryDialog";
import { GroupMemberKcalCard } from "./GroupMemberKcalCard";
import { LogEntryCard } from "./LogEntryCard";
import { MEAL_TYPES, MEAL_TYPE_LABELS } from "../../types/meal";
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
}: {
  groupId: string;
  // Resolved by LogPage (which already looks it up for the header title) so
  // this component doesn't duplicate that fetchMyGroups call — see
  // docs/pending-deviations.md (Ticket 12 follow-up, "group's all-time
  // history").
  groupName?: string | null;
}) {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();

  const [addOpen, setAddOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);

  // Reads from Dexie, not Supabase — re-renders automatically on
  // create/edit/delete (this device) and pulled remote changes alike.
  const entries = useLiveQuery(() => fetchTodayLogEntries(groupId), [groupId]);
  const loading = entries === undefined;

  // See LogEntryCard's loggedForName prop and docs/pending-deviations.md
  // (Ticket 12 follow-up, "logged by" name, and the later "log for a group
  // member" rework).
  const names = useProfileNames((entries ?? []).map((e) => e.logged_for));

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
      <Stack
        spacing={1.5}
        sx={{
          p: 2,
          maxWidth: 480,
          mx: "auto",
          pb: "calc(144px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* A daily target is personal, not group-wide — this card shows
            every member's own target (and optional per-meal breakdown)
            side by side instead of one aggregate total that wouldn't
            clearly belong to anyone. */}
        <GroupMemberKcalCard
          groupId={groupId}
          userId={userId}
          entries={entries ?? []}
        />

        <Button
          onClick={() => navigate(`/groups/${groupId}/logs`)}
          sx={{ alignSelf: "flex-start" }}
        >
          View {groupName ?? "group"}'s all-time history
        </Button>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && entries?.length === 0 && (
          <Typography
            sx={{
              color: "text.secondary",
              textAlign: "center",
              py: 4,
            }}
          >
            Nothing logged yet today in this group. Add the first entry to get
            started.
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
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "text.secondary",
                  px: 0.5,
                }}
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
                  loggedForName={names[entry.logged_for]}
                  // Every entry surfaced by fetchTodayLogEntries is already
                  // something the update RLS lets the viewer edit — editable
                  // by any fellow group member (docs/pending-deviations.md,
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
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
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
