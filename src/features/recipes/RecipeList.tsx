import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Fab from "@mui/material/Fab";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import { FloatingPortal } from "../../components/FloatingPortal";
import { PageContent } from "../../components/PageContent";
import { VirtualizedCardList } from "../../components/VirtualizedCardList";
import { useProfileNames } from "../profiles/useProfileNames";
import { fetchRecipes } from "./api";
import { RecipeCard } from "./RecipeCard";
import { CreateRecipeDialog } from "./CreateRecipeDialog";

// Initial/incremental page size for the infinite-scroll load below — see
// docs/pending-deviations.md ("List virtualization + pagination").
const PAGE_SIZE = 30;

export function RecipeList({
  groupId,
  createOpen,
  onCreateOpenChange,
}: {
  groupId: string;
  // "Add recipe" dialog visibility, lifted to RecipesPage so it can be
  // opened both by this screen's own (mobile-only, <900px) FAB below and by
  // RecipesPage's desktop (>=900px) AppHeader action Button — see
  // docs/pending-deviations.md ("Desktop 'Add' actions move from FAB to
  // header toolbar (issue #65)").
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  // Client-typed filter, matched against `name` in fetchRecipes — see that
  // function's own `search` param comment (api.ts).
  const [search, setSearch] = useState("");
  // Reset on groupId change — this component instance persists across group
  // switches on the same route, so without this a search typed while viewing
  // one group's recipes would silently keep filtering the next group too.
  useEffect(() => setSearch(""), [groupId]);

  // How many (name-sorted) recipes to load from Dexie, grown by PAGE_SIZE as
  // VirtualizedCardList reports the window scrolling near the end of the
  // currently-loaded page. Reset whenever groupId or search changes so
  // switching groups/narrowing the search doesn't carry over an inflated
  // count from a different group or a wider (or unfiltered) previous query.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => setVisibleCount(PAGE_SIZE), [groupId, search]);

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
    () => fetchRecipes(groupId, visibleCount, search),
    [groupId, visibleCount, search],
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
      <PageContent
        spacing={1.5}
        sx={{
          p: 2,
          pb: {
            xs: "calc(144px + env(safe-area-inset-bottom, 0px))",
            md: "calc(88px + env(safe-area-inset-bottom, 0px))",
          },
        }}
      >
        <TextField
          placeholder="Search recipes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon
                    fontSize="small"
                    sx={{ color: "text.secondary" }}
                  />
                </InputAdornment>
              ),
            },
          }}
        />

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
            {search.trim()
              ? "No recipes match your search."
              : "This group's recipes are empty. Add the first recipe to get started."}
          </Typography>
        )}

        {recipes && recipes.length > 0 && (
          <VirtualizedCardList
            items={recipes}
            estimateSize={76}
            gap={12}
            // See PantryList.tsx's identical prop and
            // docs/pending-deviations.md ("Multi-column card grid (issue
            // #64)").
            columns={{ xs: 1, sm: 2, lg: 3 }}
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
      </PageContent>

      <FloatingPortal>
        <Fab
          color="primary"
          aria-label="Add recipe"
          onClick={() => onCreateOpenChange(true)}
          sx={{
            position: "fixed",
            // Recipes is a bottom-tab root, so on mobile it clears BottomNav
            // (Ticket 16); at >=900px NavRail replaces BottomNav (issue #62)
            // and there's nothing left at the bottom edge to clear — see
            // docs/pending-deviations.md. Hidden at >=900px entirely: that
            // width now gets the same action as an AppHeader Button instead
            // (RecipesPage.tsx) — see docs/pending-deviations.md ("Desktop
            // 'Add' actions move from FAB to header toolbar (issue #65)").
            right: 16,
            bottom: {
              xs: "calc(80px + env(safe-area-inset-bottom, 0px))",
              md: "calc(24px + env(safe-area-inset-bottom, 0px))",
            },
            display: { xs: "inline-flex", md: "none" },
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
        onClose={() => onCreateOpenChange(false)}
        onCreated={(created) => {
          // Straight to detail, not back to the list — a brand-new recipe has
          // no ingredients yet, and that's the very next thing to add.
          navigate(`${detailPath}/${created.id}`, { replace: true });
        }}
      />
    </Box>
  );
}
