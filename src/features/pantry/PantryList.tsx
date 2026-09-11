import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Fab from "@mui/material/Fab";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAppStore } from "../../store/useAppStore";
import { FloatingPortal } from "../../components/FloatingPortal";
import { PageContent } from "../../components/PageContent";
import { VirtualizedCardList } from "../../components/VirtualizedCardList";
import { setGroupCommunityPantryEnabled } from "../groups/api";
import { useMyGroups } from "../groups/useMyGroups";
import { fetchIngredients } from "./api";
import { IngredientCard } from "./IngredientCard";
import { CreateIngredientDialog } from "./CreateIngredientDialog";

// Initial/incremental page size for the infinite-scroll load below — see
// docs/pending-deviations.md ("List virtualization + pagination").
const PAGE_SIZE = 30;

export function PantryList({ groupId }: { groupId: string }) {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // This group's own community pantry opt-in, editable right here (not on
  // group settings — see docs/pending-deviations.md, "Community pantry").
  // Only the group's owner can see/toggle it: RLS's "owner manages group"
  // policy already restricts who can actually change it, same reason the
  // gear icon to group settings is owner-only elsewhere.
  const groups = useMyGroups(userId);
  const membership = (groups ?? []).find((m) => m.group.id === groupId);
  const isGroupOwner = membership?.role === "owner";
  const communityEnabled = membership?.group.community_pantry_enabled ?? false;

  // Optimistic override while a toggle request is in flight — communityEnabled
  // above only updates once the groups cache re-fetches after invalidation,
  // which would otherwise make the switch briefly look like it snapped back
  // before catching up.
  const [pendingCommunityEnabled, setPendingCommunityEnabled] = useState<
    boolean | null
  >(null);
  const [communityToggleError, setCommunityToggleError] = useState<
    string | null
  >(null);
  const displayedCommunityEnabled = pendingCommunityEnabled ?? communityEnabled;

  async function handleCommunityToggle(checked: boolean) {
    setPendingCommunityEnabled(checked);
    setCommunityToggleError(null);
    try {
      await setGroupCommunityPantryEnabled(groupId, checked);
    } catch (err) {
      setCommunityToggleError(
        err instanceof Error
          ? err.message
          : "Couldn't update this setting. Try again.",
      );
    } finally {
      setPendingCommunityEnabled(null);
    }
  }

  // Client-typed filter, matched against `name` in fetchIngredients — see
  // that function's own `search` param comment (api.ts).
  const [search, setSearch] = useState("");
  // Reset on groupId change — this component instance persists across group
  // switches on the same route, so without this a search typed while viewing
  // one group's pantry would silently keep filtering the next group too.
  useEffect(() => setSearch(""), [groupId]);

  // How many (name-sorted, community-merged) ingredients to load from Dexie,
  // grown by PAGE_SIZE as VirtualizedCardList reports the window scrolling
  // near the end of the currently-loaded page. Reset whenever groupId, the
  // community-merge switch, or search changes so none of them carries over
  // an inflated count from a different group/merge state or a wider (or
  // unfiltered) previous query.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(
    () => setVisibleCount(PAGE_SIZE),
    [groupId, communityEnabled, search],
  );

  // Stable across renders (empty deps — functional setState needs no
  // outside values) so VirtualizedCardList's onEndReached effect only
  // re-fires on genuine scroll, not on every unrelated parent re-render
  // (e.g. the sync engine's periodic Dexie writes re-running useLiveQuery
  // above, or the community-toggle error Alert appearing/disappearing) —
  // see docs/pending-deviations.md ("List virtualization + pagination").
  const handleEndReached = useCallback(
    () => setVisibleCount((c) => c + PAGE_SIZE),
    [],
  );

  // Reads from Dexie, not Supabase — re-renders automatically on local
  // writes (this device) and pulled remote changes alike, so no manual
  // refetch/merge is needed after create/delete.
  const ingredients = useLiveQuery(
    () => fetchIngredients(groupId, communityEnabled, visibleCount, search),
    [groupId, communityEnabled, visibleCount, search],
  );
  const loading = ingredients === undefined;
  // fetchIngredients returns fewer rows than asked for only once the
  // group's whole (merged, sorted) ingredient set has been exhausted.
  const hasMore = (ingredients?.length ?? 0) >= visibleCount;
  const detailPath = `/groups/${groupId}/pantry`;

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
        spacing={1.75}
        sx={{
          p: 2,
          pb: {
            xs: "calc(144px + env(safe-area-inset-bottom, 0px))",
            md: "calc(88px + env(safe-area-inset-bottom, 0px))",
          },
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <TextField
            placeholder="Search pantry"
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
          <IconButton
            aria-label="Pantry settings"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon sx={{ color: "text.secondary" }} />
          </IconButton>
        </Stack>

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
            {search.trim()
              ? "No ingredients match your search."
              : "This group's pantry is empty. Add the first ingredient to get started."}
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
                onClick={() => navigate(`${detailPath}/${ingredient.id}`)}
              />
            )}
          />
        )}
      </PageContent>

      <FloatingPortal>
        <Fab
          color="primary"
          aria-label="Add ingredient"
          onClick={() => setCreateOpen(true)}
          sx={{
            position: "fixed",
            // Pantry is a bottom-tab root, so on mobile it clears BottomNav
            // (Ticket 16); at >=900px NavRail replaces BottomNav (issue #62)
            // and there's nothing left at the bottom edge to clear — see
            // docs/pending-deviations.md.
            right: 16,
            bottom: {
              xs: "calc(80px + env(safe-area-inset-bottom, 0px))",
              md: "calc(24px + env(safe-area-inset-bottom, 0px))",
            },
            boxShadow: (theme) =>
              theme.palette.mode === "dark"
                ? "0 6px 14px rgba(0,0,0,.5)"
                : "0 6px 14px rgba(93,110,1,.35)",
          }}
        >
          <AddIcon />
        </Fab>
      </FloatingPortal>

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Pantry settings</DialogTitle>
        <DialogContent>
          <Stack spacing={1.75} sx={{ pt: 0.5 }}>
            {isGroupOwner && (
              <Box>
                <Typography sx={{ fontSize: 14 }}>
                  Do you want to enable the community pantry ingredients for
                  this group?
                </Typography>
                <RadioGroup
                  value={displayedCommunityEnabled ? "yes" : "no"}
                  onChange={(e) =>
                    handleCommunityToggle(e.target.value === "yes")
                  }
                >
                  <FormControlLabel
                    value="yes"
                    control={<Radio size="small" />}
                    label="Yes"
                    disabled={pendingCommunityEnabled !== null}
                  />
                  <FormControlLabel
                    value="no"
                    control={<Radio size="small" />}
                    label="No"
                    disabled={pendingCommunityEnabled !== null}
                  />
                </RadioGroup>
              </Box>
            )}
            {communityToggleError && (
              <Alert severity="error">{communityToggleError}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Button
            variant="outlined"
            onClick={() => navigate("/community-pantry")}
          >
            Browse community pantry
          </Button>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <CreateIngredientDialog
        open={createOpen}
        groupId={groupId}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          // Straight to detail, not back to the list (mirrors
          // RecipeList.tsx's onCreated) — fetchIngredients now windows the
          // name-sorted list to `visibleCount` rows (see
          // docs/pending-deviations.md, "List virtualization + pagination"),
          // so a newly created ingredient that sorts alphabetically past the
          // currently loaded page would otherwise silently not appear in the
          // list at all. Navigating to its detail page both confirms the
          // create succeeded and sidesteps that windowing entirely.
          setCreateOpen(false);
          navigate(`${detailPath}/${created.id}`, { replace: true });
        }}
      />
    </Box>
  );
}
