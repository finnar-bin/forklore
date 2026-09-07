import { useCallback, useEffect, useState } from "react";
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
import { useProfileNames } from "../profiles/useProfileNames";
import { fetchRecipes } from "./api";
import { RecipeCard } from "./RecipeCard";
import { CreateRecipeDialog } from "./CreateRecipeDialog";

// Initial/incremental page size for the infinite-scroll load below — see
// docs/pending-deviations.md ("List virtualization + pagination").
const PAGE_SIZE = 30;

export function RecipeList({ groupId }: { groupId: string }) {
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);

  // How many (name-sorted) recipes to load from Dexie, grown by PAGE_SIZE as
  // VirtualizedCardList reports the window scrolling near the end of the
  // currently-loaded page. Reset whenever groupId changes so switching
  // groups doesn't carry over an inflated count from the previous one.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => setVisibleCount(PAGE_SIZE), [groupId]);

  // Stable across renders (empty deps — functional setState needs no
  // outside values) so VirtualizedCardList's onEndReached effect only
  // re-fires on genuine scroll, not on every unrelated parent re-render
  // (e.g. the sync engine's periodic Dexie writes re-running useLiveQuery
  // above) — see docs/pending-deviations.md ("List virtualization +
  // pagination").
  const handleEndReached = useCallback(
    () => setVisibleCount((c) => c + PAGE_SIZE),
    [],
  );

  // Reads from Dexie, not Supabase — re-renders automatically on local
  // writes (this device) and pulled remote changes alike.
  const recipes = useLiveQuery(
    () => fetchRecipes(groupId, visibleCount),
    [groupId, visibleCount],
  );
  const loading = recipes === undefined;
  // fetchRecipes returns fewer rows than asked for only once the group's
  // whole (sorted) recipe set has been exhausted.
  const hasMore = (recipes?.length ?? 0) >= visibleCount;
  const detailPath = `/groups/${groupId}/recipes`;

  // See RecipeCard's creatorName prop and docs/pending-deviations.md
  // (Ticket 12).
  const creatorNames = useProfileNames(
    (recipes ?? []).map((r) => r.created_by),
  );

  return (
    // Root box, not a nested wrapper — see design-system.md's FAB positioning
    // note. The FAB itself uses position: fixed (anchored to the viewport),
    // not absolute — absolute anchored it to this box, which grows with the
    // list, pushing the FAB off-screen once the list got long. It's also
    // wrapped in FloatingPortal (Ticket 16) so AnimatedAppShell's animated
    // transform doesn't hijack its fixed positioning.
    <Box sx={{ position: "relative", minHeight: "calc(100vh - 64px)" }}>
      {/* pb clears both the FAB (bottom: 80) and BottomNav below it — see
          docs/pending-deviations.md (Ticket 16). */}
      <Stack
        spacing={1.5}
        sx={{
          p: 2,
          maxWidth: 480,
          mx: "auto",
          pb: "calc(144px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && recipes?.length === 0 && (
          <Typography
            sx={{
              color: "text.secondary",
              textAlign: "center",
              py: 4,
            }}
          >
            This group's recipes are empty. Add the first recipe to get started.
          </Typography>
        )}

        {recipes && recipes.length > 0 && (
          <VirtualizedCardList
            items={recipes}
            estimateSize={76}
            gap={12}
            getItemKey={(recipe) => recipe.id}
            hasMore={hasMore}
            onEndReached={handleEndReached}
            renderItem={(recipe) => (
              <RecipeCard
                recipe={recipe}
                creatorName={creatorNames[recipe.created_by]}
                onClick={() => navigate(`${detailPath}/${recipe.id}`)}
              />
            )}
          />
        )}
      </Stack>

      <FloatingPortal>
        <Fab
          color="primary"
          aria-label="Add recipe"
          onClick={() => setCreateOpen(true)}
          sx={{
            position: "fixed",
            // Recipes is a bottom-tab root, so it clears BottomNav — see
            // docs/pending-deviations.md (Ticket 16).
            right: 16,
            bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
            boxShadow: (theme) =>
              theme.palette.mode === "dark"
                ? "0 6px 14px rgba(0,0,0,.5)"
                : "0 6px 14px rgba(93,110,1,.35)",
          }}
        >
          <AddIcon />
        </Fab>
      </FloatingPortal>

      <CreateRecipeDialog
        open={createOpen}
        groupId={groupId}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          // Straight to detail, not back to the list — a brand-new recipe has
          // no ingredients yet, and that's the very next thing to add.
          navigate(`${detailPath}/${created.id}`, { replace: true });
        }}
      />
    </Box>
  );
}
