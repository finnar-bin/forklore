import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import { AppHeader } from "../components/AppHeader";
import { CommunityPantryList } from "../features/community/CommunityPantryList";
import { useHomePath } from "../store/useAppStore";

// Reached from a button on /groups/:id/pantry (see
// docs/pending-deviations.md, "Community pantry"), not a bottom tab — falls
// back to the resolved default group's pantry, same convention
// SyncStatusPage/ProfilePage/GroupsPage already use for a screen reachable
// from more than one place.
export function CommunityPantryPage() {
  const navigate = useNavigate();
  const homePath = useHomePath();
  // Lifted here (rather than local to CommunityPantryList) so it can be
  // opened both by CommunityPantryList's own mobile-only (<900px) FAB and
  // by this desktop (>=900px) AppHeader action Button — see
  // docs/pending-deviations.md ("Desktop 'Add' actions move from FAB to
  // header toolbar (issue #65)").
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title="Community pantry"
        onBack={() => navigate(homePath ?? "/groups")}
        action={
          <Button
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ display: { xs: "none", md: "inline-flex" } }}
          >
            Add to community pantry
          </Button>
        }
      />
      <CommunityPantryList
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
      />
    </Box>
  );
}
