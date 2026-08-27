import Box from "@mui/material/Box";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { GroupList } from "../features/groups/GroupList";
import { useHomePath } from "../store/useAppStore";

// Reached via the header Groups icon (routes.md, design-system.md) — not a
// bottom tab, so there's no single parent tab root to derive a back path
// from. Falls back to the resolved default group's pantry (or plain
// /groups if that hasn't resolved yet — see useHomePath), same convention
// SyncStatusPage/ProfilePage already use for a header icon reachable from
// anywhere.
export function GroupsPage() {
  const navigate = useNavigate();
  const homePath = useHomePath();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title="Groups"
        onBack={() => navigate(homePath ?? "/groups")}
      />
      <GroupList />
    </Box>
  );
}
