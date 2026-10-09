import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { Converter } from "../features/converter/Converter";

// No `:groupId` param, and unlike Progress, no `userId` dependency either —
// this tab holds no user or group data at all, see
// docs/pending-deviations.md ("Converter tab").
export function ConverterPage() {
  const navigate = useNavigate();
  // Below the desktop rail breakpoint it's reached from a header shortcut,
  // so it needs a way back.
  const compact = useMediaQuery(useTheme().breakpoints.down("md"));
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title="Converter"
        onBack={compact ? () => navigate(-1) : undefined}
      />
      <Converter />
    </Box>
  );
}
