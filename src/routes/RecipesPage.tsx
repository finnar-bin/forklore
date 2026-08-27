import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import { AppHeader } from "../components/AppHeader";
import { ContextSwitcher } from "../components/ContextSwitcher";
import { RecipeList } from "../features/recipes/RecipeList";

export function RecipesPage() {
  const { groupId } = useParams<{ groupId: string }>();
  if (!groupId) return null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader title="Recipes" />
      <ContextSwitcher tab="recipes" activeGroupId={groupId} />
      <RecipeList groupId={groupId} />
    </Box>
  );
}
