import Box from "@mui/material/Box";
import { AppHeader } from "../components/AppHeader";
import { Converter } from "../features/converter/Converter";

// No `:groupId` param, and unlike Progress, no `userId` dependency either —
// this tab holds no user or group data at all, see
// docs/pending-deviations.md ("Converter tab").
export function ConverterPage() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader title="Converter" />
      <Converter />
    </Box>
  );
}
