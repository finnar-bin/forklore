import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import { AppHeader } from "../components/AppHeader";
import { DailyLog } from "../features/logging/DailyLog";
import { useMyGroups } from "../features/groups/useMyGroups";
import { useAppStore, useSyncedActiveGroupId } from "../store/useAppStore";

// No ContextSwitcher here (unlike PantryPage/RecipesPage) — bare /log is
// cross-context (everything logged across every group the user is in), and
// switching to one group's own shared log is a deliberate navigation via
// "View group logs" (see GroupLogPicker), not an ambient toggle. This page
// still renders /groups/:groupId/log — that route just shows the group's
// name and a way back instead of the switcher chip. See
// docs/pending-deviations.md (Ticket 12 follow-up, "/log shows everything",
// and "Remove personal mode" for why the cross-context view survived
// dropping personal ownership while /pantry and /recipes didn't).
export function LogPage() {
  const { groupId: routeGroupId } = useParams<{ groupId?: string }>();
  const groupId = useSyncedActiveGroupId(routeGroupId);
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();
  // Read unconditionally (not just when groupId is set) so the bare,
  // cross-context page also knows whether "View group logs" has anything
  // to lead to —
  // requested directly: hide it entirely for a user in no groups at all.
  // Shared cache (see useMyGroups) rather than this page's own fetch, since
  // Log is a BottomNav tab and remounts on every tap.
  const groups = useMyGroups(userId);

  const groupName = groupId
    ? (groups?.find((m) => m.group.id === groupId)?.group.name ?? "Group")
    : null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title={groupId ? `${groupName} log` : "Log"}
        onBack={groupId ? () => navigate("/log") : undefined}
      />
      <DailyLog
        groupId={groupId}
        groupName={groupName}
        hasGroups={(groups?.length ?? 0) > 0}
      />
    </Box>
  );
}
