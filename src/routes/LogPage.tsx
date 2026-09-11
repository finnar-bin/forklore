import { useParams } from "react-router-dom";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
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
  // Lifted here (rather than local to DailyLog) so it can be opened both
  // by DailyLog's own mobile-only (<900px) FAB and by this desktop
  // (>=900px) AppHeader action Button — see docs/pending-deviations.md
  // ("Desktop 'Add' actions move from FAB to header toolbar (issue #65)").
  const [addOpen, setAddOpen] = useState(false);
  if (!groupId) return null;

  const groupName =
    groups?.find((m) => m.group.id === groupId)?.group.name ?? "Group";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title={`${groupName} log`}
        action={
          <Button
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
            sx={{ display: { xs: "none", md: "inline-flex" } }}
          >
            Log an entry
          </Button>
        }
      />
      <DailyLog
        groupId={groupId}
        addOpen={addOpen}
        onAddOpenChange={setAddOpen}
      />
    </Box>
  );
}
