import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Fab from "@mui/material/Fab";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { FloatingPortal } from "../../components/FloatingPortal";
import { fetchCommunityIngredients } from "../pantry/api";
import { CreateIngredientDialog } from "../pantry/CreateIngredientDialog";
import { IngredientCard } from "../pantry/IngredientCard";

// Every community ingredient, browsable by any signed-in user regardless of
// their own or any group's opt-in switch — see docs/pending-deviations.md
// ("Community pantry"). Same list/FAB/detail-navigation shape as
// PantryList.tsx, minus the ContextSwitcher (there's no group context here)
// and minus the opt-in gating (this page always shows every community
// ingredient, to everyone).
export function CommunityPantryList() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const ingredients = useLiveQuery(() => fetchCommunityIngredients(), []);
  const loading = ingredients === undefined;

  return (
    <Box sx={{ position: "relative", minHeight: "calc(100vh - 64px)" }}>
      <Stack spacing={1.75} sx={{ p: 2, maxWidth: 480, mx: "auto", pb: 10 }}>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && ingredients?.length === 0 && (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            No community ingredients yet. Add the first one to get started.
          </Typography>
        )}

        {(ingredients ?? []).map((ingredient) => (
          <IngredientCard
            key={ingredient.id}
            ingredient={ingredient}
            showCommunityIndicator={false}
            onClick={() => navigate(`/community-pantry/${ingredient.id}`)}
          />
        ))}
      </Stack>

      <FloatingPortal>
        <Fab
          color="primary"
          aria-label="Add to community pantry"
          onClick={() => setCreateOpen(true)}
          sx={{
            position: "fixed",
            right: 16,
            bottom: 24,
            boxShadow: (theme) =>
              theme.palette.mode === "dark"
                ? "0 6px 14px rgba(0,0,0,.5)"
                : "0 6px 14px rgba(93,110,1,.35)",
          }}
        >
          <AddIcon />
        </Fab>
      </FloatingPortal>

      <CreateIngredientDialog
        open={createOpen}
        isCommunity
        onClose={() => setCreateOpen(false)}
        onCreated={() => setCreateOpen(false)}
      />
    </Box>
  );
}
