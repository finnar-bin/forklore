import Box from "@mui/material/Box";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { SyncStatusList } from "../features/sync/SyncStatusList";

export function SyncStatusPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader title="Sync status" onBack={() => navigate("/pantry")} />
      <SyncStatusList />
    </Box>
  );
}
