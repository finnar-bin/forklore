import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { AppHeader } from "../components/AppHeader";
import { GroupList } from "../features/groups/GroupList";

// Reached via the header Groups icon (routes.md, design-system.md), and now
// also a primary landing destination in its own right — "/" sends a user
// here whenever no group context has been explicitly picked yet (see
// resolveDefaultGroupId, docs/pending-deviations.md, "Remove personal
// mode"). No back arrow: unlike SyncStatusPage/ProfilePage (reached from
// exactly one place, always with somewhere to return to), this screen is
// now just as often a starting point as a detour, so a fixed "back"
// destination doesn't make sense here — the header's Groups icon is also
// hidden while already on this route, matching that.
export function GroupsPage() {
  // Lifted here (rather than local to GroupList) so it can be opened both
  // by GroupList's own mobile-only (<900px) FAB and by this desktop
  // (>=900px) AppHeader action Button — see docs/pending-deviations.md
  // ("Desktop 'Add' actions move from FAB to header toolbar (issue #65)").
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title="Groups"
        action={
          <Button
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ display: { xs: "none", md: "inline-flex" } }}
          >
            Create group
          </Button>
        }
      />
      <GroupList createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
    </Box>
  );
}
