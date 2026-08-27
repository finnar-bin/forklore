import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import { AppHeader } from "../components/AppHeader";
import { DailyLog } from "../features/logging/DailyLog";
import { useAppStore } from "../store/useAppStore";
import { useMyGroups } from "../features/groups/useMyGroups";

// No group switcher here — Pantry/Recipes' own ContextSwitcher chip was
// removed too (requested directly); switching groups now only happens via
// a GroupCard tap on /groups (see GroupCard.tsx), and BottomNav already
// lands on whichever group is currently active. A bottom-tab root, so no
// back arrow either, matching PantryPage/RecipesPage/ProgressPage.
export function LogPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const userId = useAppStore((state) => state.userId);
  const groups = useMyGroups(userId);
  if (!groupId) return null;

  const groupName =
    groups?.find((m) => m.group.id === groupId)?.group.name ?? "Group";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader title={`${groupName} log`} />
      <DailyLog groupId={groupId} groupName={groupName} />
    </Box>
  );
}
