import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Fab from "@mui/material/Fab";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { FloatingPortal } from "../../components/FloatingPortal";
import { VirtualizedCardList } from "../../components/VirtualizedCardList";
import { fetchCommunityIngredients } from "../pantry/api";
import { CreateIngredientDialog } from "../pantry/CreateIngredientDialog";
import { IngredientCard } from "../pantry/IngredientCard";

// Initial/incremental page size for the infinite-scroll load below — see
// docs/pending-deviations.md ("List virtualization + pagination").
const PAGE_SIZE = 30;

// Every community ingredient, browsable by any signed-in user regardless of
// their own or any group's opt-in switch — see docs/pending-deviations.md
// ("Community pantry"). Same list/FAB/detail-navigation shape as
// PantryList.tsx, minus the opt-in gating (this page always shows every
// community ingredient, to everyone) — there's no group context here at
// all, so nothing to switch between regardless.
export function CommunityPantryList() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  // How many (name-sorted) community ingredients to load from Dexie, grown
  // by PAGE_SIZE as VirtualizedCardList reports the window scrolling near
  // the end of the currently-loaded page.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Stable across renders (empty deps — functional setState needs no
  // outside values) so VirtualizedCardList's onEndReached effect only
  // re-fires on genuine scroll, not on every unrelated parent re-render
  // (e.g. the sync engine's periodic Dexie writes re-running useLiveQuery
  // below) — see docs/pending-deviations.md ("List virtualization +
  // pagination").
  const handleEndReached = useCallback(
    () => setVisibleCount((c) => c + PAGE_SIZE),
    [],
  );

  const ingredients = useLiveQuery(
    () => fetchCommunityIngredients(visibleCount),
    [visibleCount],
  );
  const loading = ingredients === undefined;
  // fetchCommunityIngredients returns fewer rows than asked for only once
  // the whole community pantry has been exhausted.
  const hasMore = (ingredients?.length ?? 0) >= visibleCount;

  return (
    <Box sx={{ position: "relative", minHeight: "calc(100vh - 64px)" }}>
      <Stack
        spacing={1.75}
        sx={{
          p: 2,
          maxWidth: 480,
          mx: "auto",
          pb: "calc(80px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && ingredients?.length === 0 && (
          <Typography
            sx={{
              color: "text.secondary",
              textAlign: "center",
              py: 4,
            }}
          >
            No community ingredients yet. Add the first one to get started.
          </Typography>
        )}

        {ingredients && ingredients.length > 0 && (
          <VirtualizedCardList
            items={ingredients}
            estimateSize={80}
            gap={14}
            getItemKey={(ingredient) => ingredient.id}
            hasMore={hasMore}
            onEndReached={handleEndReached}
            renderItem={(ingredient) => (
              <IngredientCard
                ingredient={ingredient}
                showCommunityIndicator={false}
                onClick={() => navigate(`/community-pantry/${ingredient.id}`)}
              />
            )}
          />
        )}
      </Stack>

      <FloatingPortal>
        <Fab
          color="primary"
          aria-label="Add to community pantry"
          onClick={() => setCreateOpen(true)}
          sx={{
            position: "fixed",
            right: 16,
            bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
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
        onCreated={(created) => {
          // Straight to detail, not back to the list — same fix as
          // PantryList.tsx's onCreated, same reason: fetchCommunityIngredients
          // windows the name-sorted list to `visibleCount` rows, so a newly
          // created ingredient sorting past the currently loaded page would
          // otherwise silently not appear in the list at all.
          setCreateOpen(false);
          navigate(`/community-pantry/${created.id}`, { replace: true });
        }}
      />
    </Box>
  );
}
