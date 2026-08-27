import Box from "@mui/material/Box";
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
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader title="Groups" />
      <GroupList />
    </Box>
  );
}
