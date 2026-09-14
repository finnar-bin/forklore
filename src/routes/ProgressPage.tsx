import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { AppHeader } from "../components/AppHeader";
import { Progress } from "../features/progress/Progress";
import { useAppStore } from "../store/useAppStore";

// No `:groupId` param — Progress ignores the active group context entirely
// (routes.md).
export function ProgressPage() {
  const userId = useAppStore((state) => state.userId);
  // Lifted here (rather than local to Progress) so it can be opened both
  // by Progress's own mobile-only (<900px) FAB and by this desktop
  // (>=900px) AppHeader action Button — see docs/pending-deviations.md
  // ("Desktop 'Add' actions move from FAB to header toolbar (issue #65)").
  const [logOpen, setLogOpen] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title="Progress"
        action={
          <Button
            startIcon={<AddIcon />}
            onClick={() => setLogOpen(true)}
            sx={{ display: { xs: "none", md: "inline-flex" } }}
          >
            Log weight
          </Button>
        }
      />
      {userId && (
        <Progress
          userId={userId}
          logOpen={logOpen}
          onLogOpenChange={setLogOpen}
        />
      )}
    </Box>
  );
}
