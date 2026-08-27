import Box from "@mui/material/Box";
import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { RecipeDetail } from "../features/recipes/RecipeDetail";

export function RecipeDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  if (!groupId) return null;
  const backPath = `/groups/${groupId}/recipes`;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader title="Recipe" onBack={() => navigate(backPath)} />
      <RecipeDetail groupId={groupId} backPath={backPath} />
    </Box>
  );
}
