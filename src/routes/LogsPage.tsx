import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import { AppHeader } from "../components/AppHeader";
import { AllTimeLog } from "../features/logging/AllTimeLog";
import { useMyGroups } from "../features/groups/useMyGroups";
import { useAppStore } from "../store/useAppStore";

// /groups/:groupId/logs — a group's own all-time history. The bare,
// cross-context /logs this page used to also serve was removed (requested
// directly, alongside bare /log).
export function LogsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();
  // Shared cache (see useMyGroups) rather than this page's own fetch.
  const groups = useMyGroups(userId);
  if (!groupId) return null;

  const groupName =
    groups?.find((m) => m.group.id === groupId)?.group.name ?? "Group";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title={`${groupName} all-time log`}
        onBack={() => navigate(`/groups/${groupId}/log`)}
      />
      <AllTimeLog groupId={groupId} />
    </Box>
  );
}
