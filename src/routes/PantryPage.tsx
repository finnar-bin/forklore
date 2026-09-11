import { useParams } from "react-router-dom";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { AppHeader } from "../components/AppHeader";
import { PantryList } from "../features/pantry/PantryList";

export function PantryPage() {
  const { groupId } = useParams<{ groupId: string }>();
  // Lifted here (rather than local to PantryList) so it can be opened both
  // by PantryList's own mobile-only (<900px) FAB and by this desktop
  // (>=900px) AppHeader action Button — see docs/pending-deviations.md
  // ("Desktop 'Add' actions move from FAB to header toolbar (issue #65)").
  const [createOpen, setCreateOpen] = useState(false);
  if (!groupId) return null;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppHeader
        title="Pantry"
        action={
          <Button
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ display: { xs: "none", md: "inline-flex" } }}
          >
            Add ingredient
          </Button>
        }
      />
      <PantryList
        groupId={groupId}
        createOpen={createOpen}
        onCreateOpenChange={setCreateOpen}
      />
    </Box>
  );
}
