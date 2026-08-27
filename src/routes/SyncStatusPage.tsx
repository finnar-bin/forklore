import Box from "@mui/material/Box";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { SyncStatusList } from "../features/sync/SyncStatusList";
import { useHomePath } from "../store/useAppStore";

export function SyncStatusPage() {
  const navigate = useNavigate();
  const homePath = useHomePath();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title="Sync status"
        onBack={() => navigate(homePath ?? "/groups")}
      />
      <SyncStatusList />
    </Box>
  );
}
