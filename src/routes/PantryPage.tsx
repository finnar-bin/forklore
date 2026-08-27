import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import { AppHeader } from "../components/AppHeader";
import { PantryList } from "../features/pantry/PantryList";

export function PantryPage() {
  const { groupId } = useParams<{ groupId: string }>();
  if (!groupId) return null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader title="Pantry" />
      <PantryList groupId={groupId} />
    </Box>
  );
}
