import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import { AppHeader } from "../components/AppHeader";
import { AllTimeLog } from "../features/logging/AllTimeLog";
import { useMyGroups } from "../features/groups/useMyGroups";
import { useAppStore } from "../store/useAppStore";

// /logs (cross-context, every group combined) and /groups/:groupId/logs (one
// group's own all-time history — Ticket 12 follow-up, "group's all-time
// history") share this page, same pattern LogPage already uses for /log vs.
// /groups/:groupId/log.
export function LogsPage() {
  const { groupId } = useParams<{ groupId?: string }>();
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();
  // Shared cache (see useMyGroups) rather than this page's own fetch.
  const groups = useMyGroups(userId);
  const groupName = groupId
    ? (groups?.find((m) => m.group.id === groupId)?.group.name ?? "Group")
    : null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title={
          groupId ? `${groupName ?? "Group"} all-time log` : "All-time log"
        }
        onBack={() => navigate(groupId ? `/groups/${groupId}/log` : "/log")}
      />
      <AllTimeLog groupId={groupId ?? null} />
    </Box>
  );
}
