import Box from "@mui/material/Box";
import { AppHeader } from "../components/AppHeader";
import { Progress } from "../features/progress/Progress";
import { useAppStore } from "../store/useAppStore";

// No ContextSwitcher and no `:groupId` param, unlike PantryPage/RecipesPage —
// Progress ignores the active group context entirely (routes.md).
export function ProgressPage() {
  const userId = useAppStore((state) => state.userId);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader title="Progress" />
      {userId && <Progress userId={userId} />}
    </Box>
  );
}
