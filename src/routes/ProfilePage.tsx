import Box from "@mui/material/Box";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { Profile } from "../features/profiles/Profile";
import { useHomePath } from "../store/useAppStore";

// Reached via the header avatar icon (routes.md, design-system.md) — not a
// bottom tab, so there's no single parent tab root to derive a back path
// from. Falls back to the resolved default group's pantry, same convention
// SyncStatusPage already uses for a header icon reachable from anywhere.
export function ProfilePage() {
  const navigate = useNavigate();
  const homePath = useHomePath();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title="Profile"
        onBack={() => navigate(homePath ?? "/groups")}
      />
      <Profile />
    </Box>
  );
}
