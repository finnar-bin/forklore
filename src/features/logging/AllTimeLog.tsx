import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { PageContent } from "../../components/PageContent";
import {
  VirtualizedSectionedCardList,
  type VirtualizedSection,
} from "../../components/VirtualizedSectionedCardList";
import { useProfileNames } from "../profiles/useProfileNames";
import { fetchAllGroupLogEntries } from "./api";
import { EditLogEntryDialog } from "./EditLogEntryDialog";
import { LogEntryCard } from "./LogEntryCard";
import { LogUserFilter } from "./LogUserFilter";
import { MEAL_TYPE_SECTIONS } from "./DailyLog";
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

  // Narrows every day's entries to one member's own — see LogUserFilter.tsx.
  // null (default) shows every member's, same as DailyLog.tsx. Reset
  // whenever groupId changes, same reasoning/pattern as visibleCount below
  // — this component instance persists across a group switch (same route,
  // new :groupId param, no remount), so a stale userId selected in the
  // previous group would otherwise stick around even when it isn't a member
  // of the new one, silently showing "nothing logged" instead of resetting
  // to "Everyone".
  const [filterUser, setFilterUser] = useState<string | null>(null);
  useEffect(() => setFilterUser(null), [groupId]);

  // How many (logged_at/created_at-sorted) entries to load from Dexie, grown
  // by PAGE_SIZE as VirtualizedSectionedCardList reports the window
  // scrolling near the end of the currently-loaded page. Reset whenever
  // groupId changes so switching groups doesn't carry over an inflated
  // count from the previous one. Also reset on filterUser changes — it
  // windows over the *filtered* set now (see fetchAllGroupLogEntries), so a
  // count grown against "Everyone" shouldn't carry over to a newly-picked
  // member's own (likely much shorter) history, or vice versa.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => setVisibleCount(PAGE_SIZE), [groupId, filterUser]);

  const handleEndReached = useCallback(
    () => setVisibleCount((c) => c + PAGE_SIZE),
    [],
  );

  // Reads from Dexie, not Supabase — re-renders automatically on
  // create/edit/delete (this device) and pulled remote changes alike.
  // filterUser is applied inside the query, before visibleCount slices the
  // result, so hasMore/onEndReached page over the filtered set — see
  // fetchAllGroupLogEntries's doc for why (a member's entries could
  // otherwise sit past the loaded page with no way left to reach them).
  const entries = useLiveQuery(
    () => fetchAllGroupLogEntries(groupId, visibleCount, filterUser),
    [groupId, visibleCount, filterUser],
  );
  const loading = entries === undefined;
  // fetchAllGroupLogEntries returns fewer rows than asked for only once the
  // (filtered) history has been exhausted.
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

  // Each day's entries are further split into DailyLog.tsx's own meal-type
  // sections (MEAL_TYPE_SECTIONS), each becoming its own
  // VirtualizedSectionedCardList section — the list has no native nested-
  // section support, so the day header (weekday/date + day kcal total,
  // reproducing the pre-existing outer grouping) is folded into the first
  // non-empty meal-type section of each day instead of getting a row of its
  // own; every later meal-type section within that same day gets just its
  // own label. Flattened into one row list so only near-viewport rows are
  // ever mounted, regardless of history length.
  const virtualSections = useMemo<VirtualizedSection<LogEntry>[]>(() => {
    const sections: VirtualizedSection<LogEntry>[] = [];
    for (const [date, dayEntries] of groups) {
      const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.kcal, 0);
      const mealSections = MEAL_TYPE_SECTIONS.map(({ key, label }) => ({
        label,
        items: dayEntries.filter((entry) => (entry.meal_type ?? null) === key),
      })).filter((section) => section.items.length > 0);

      mealSections.forEach((section, index) => {
        sections.push({
          key: `${date}:${section.label}`,
          header: (
            <Box>
              {index === 0 && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    mb: 0.5,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "text.secondary",
                    }}
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
              )}
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "text.secondary",
                  px: 0.5,
                }}
              >
                {section.label}
              </Typography>
            </Box>
          ),
          items: section.items,
        });
      });
    }
    return sections;
  }, [groups]);

  return (
    <PageContent spacing={2} sx={{ p: 2, pb: 4 }}>
      <LogUserFilter
        groupId={groupId}
        value={filterUser}
        onChange={setFilterUser}
      />

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
          {filterUser !== null
            ? "Nothing logged by this member."
            : "Nothing logged yet in this group. Entries logged here will show up."}
        </Typography>
      )}

      {!loading && groups.length > 0 && (
        <VirtualizedSectionedCardList
          sections={virtualSections}
          estimateSize={76}
          // A section's own header is either just a meal-type label (28px,
          // one line) or that plus the day header row above it (a second
          // line) for the first meal-type section of each day — see
          // virtualSections above. This only seeds the virtualizer's
          // not-yet-measured estimate; actual heights are measured per row
          // (measureElement), so a mixed estimate here doesn't misrender
          // either kind, just the initial scroll math before measurement.
          headerEstimateSize={44}
          gap={12}
          // Reproduces the day-group Stack's own spacing={2} (16px) between
          // days on top of the within-day spacing={1.5} (12px) gap above —
          // see VirtualizedSectionedCardList's extraSectionGap doc. Applied
          // between every meal-type sub-section now (not just day
          // boundaries), which also lightly separates same-day meal
          // sections — an acceptable simplification, since
          // VirtualizedSectionedCardList only exposes one uniform value.
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
    </PageContent>
  );
}
