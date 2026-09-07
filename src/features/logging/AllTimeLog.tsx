import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  VirtualizedSectionedCardList,
  type VirtualizedSection,
} from "../../components/VirtualizedSectionedCardList";
import { useProfileNames } from "../profiles/useProfileNames";
import { fetchAllGroupLogEntries } from "./api";
import { EditLogEntryDialog } from "./EditLogEntryDialog";
import { LogEntryCard } from "./LogEntryCard";
import type { LogEntry } from "../../types/log";

// Initial/incremental page size for the infinite-scroll load below — same
// pattern and value as RecipeList.tsx/PantryList.tsx (see
// docs/pending-deviations.md, "List virtualization + pagination"). This is
// the log screen most exposed to unbounded growth (a group's whole
// history), unlike DailyLog.tsx which is naturally capped to "today."
const PAGE_SIZE = 30;

// A group's own all-time history — every entry logged into it by any
// member, same scoping DailyLog's own query uses for "today." The bare,
// cross-context all-time view this component used to also serve (a null
// `groupId`) was removed (requested directly, alongside bare /log/`/logs`).
export function AllTimeLog({ groupId }: { groupId: string }) {
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);

  // How many (logged_at/created_at-sorted) entries to load from Dexie, grown
  // by PAGE_SIZE as VirtualizedSectionedCardList reports the window
  // scrolling near the end of the currently-loaded page. Reset whenever
  // groupId changes so switching groups doesn't carry over an inflated
  // count from the previous one.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => setVisibleCount(PAGE_SIZE), [groupId]);

  const handleEndReached = useCallback(
    () => setVisibleCount((c) => c + PAGE_SIZE),
    [],
  );

  // Reads from Dexie, not Supabase — re-renders automatically on
  // create/edit/delete (this device) and pulled remote changes alike.
  const entries = useLiveQuery(
    () => fetchAllGroupLogEntries(groupId, visibleCount),
    [groupId, visibleCount],
  );
  const loading = entries === undefined;
  // fetchAllGroupLogEntries returns fewer rows than asked for only once the
  // group's whole (sorted) history has been exhausted.
  const hasMore = (entries?.length ?? 0) >= visibleCount;

  const names = useProfileNames((entries ?? []).map((e) => e.logged_for));

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

  // Each day's LogEntryCards plus its own header (weekday/date + day kcal
  // total) — flattened into VirtualizedSectionedCardList's row list so only
  // near-viewport rows are ever mounted, regardless of history length.
  const virtualSections = useMemo<VirtualizedSection<LogEntry>[]>(
    () =>
      groups.map(([date, dayEntries]) => {
        const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.kcal, 0);
        return {
          key: date,
          header: (
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <Typography
                sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary" }}
              >
                {new Date(`${date}T00:00:00`).toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                {dayTotal.toFixed(2)} kcal
              </Typography>
            </Box>
          ),
          items: dayEntries,
        };
      }),
    [groups],
  );

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, mx: "auto", pb: 4 }}>
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && groups.length === 0 && (
        <Typography
          sx={{
            color: "text.secondary",
            textAlign: "center",
            py: 4,
          }}
        >
          Nothing logged yet in this group. Entries logged here will show up.
        </Typography>
      )}

      {!loading && groups.length > 0 && (
        <VirtualizedSectionedCardList
          sections={virtualSections}
          estimateSize={76}
          headerEstimateSize={28}
          gap={12}
          // Reproduces the day-group Stack's own spacing={2} (16px) between
          // days on top of the within-day spacing={1.5} (12px) gap above —
          // see VirtualizedSectionedCardList's extraSectionGap doc.
          extraSectionGap={4}
          getItemKey={(entry) => entry.id}
          hasMore={hasMore}
          onEndReached={handleEndReached}
          renderItem={(entry) => (
            <LogEntryCard
              entry={entry}
              subtitle={new Date(entry.created_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
              loggedForName={names[entry.logged_for]}
              // See DailyLog's identical onClick comment — every entry
              // here is already something the update RLS lets the viewer
              // edit, group-inclusive since the "log for a group member"
              // rework.
              onClick={() => setEditingEntry(entry)}
            />
          )}
        />
      )}

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
