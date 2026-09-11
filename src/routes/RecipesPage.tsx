import { useParams } from "react-router-dom";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { AppHeader } from "../components/AppHeader";
import { RecipeList } from "../features/recipes/RecipeList";

export function RecipesPage() {
  const { groupId } = useParams<{ groupId: string }>();
  // Lifted here (rather than local to RecipeList) so it can be opened both
  // by RecipeList's own mobile-only (<900px) FAB and by this desktop
  // (>=900px) AppHeader action Button — see docs/pending-deviations.md
  // ("Desktop 'Add' actions move from FAB to header toolbar (issue #65)").
  const [createOpen, setCreateOpen] = useState(false);
  if (!groupId) return null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title="Recipes"
        action={
          <Button
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ display: { xs: "none", md: "inline-flex" } }}
          >
            Add recipe
          </Button>
        }
      />
      <RecipeList
        groupId={groupId}
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
      />
    </Box>
  );
}
