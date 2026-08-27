import Box from "@mui/material/Box";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { GroupList } from "../features/groups/GroupList";

// Reached via the header Groups icon (routes.md, design-system.md) — not a
// bottom tab, so there's no single parent tab root to derive a back path
// from. Falls back to /pantry, same fixed-path convention SyncStatusPage/
// ProfilePage already use for a header icon reachable from anywhere.
export function GroupsPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader title="Groups" onBack={() => navigate("/pantry")} />
      <GroupList />
    </Box>
  );
}
