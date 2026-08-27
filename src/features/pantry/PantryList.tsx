import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Fab from "@mui/material/Fab";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../../theme/theme";
import { useAppStore } from "../../store/useAppStore";
import { FloatingPortal } from "../../components/FloatingPortal";
import { setGroupCommunityPantryEnabled } from "../groups/api";
import { useMyGroups } from "../groups/useMyGroups";
import { fetchIngredients } from "./api";
import { IngredientCard } from "./IngredientCard";
import { CreateIngredientDialog } from "./CreateIngredientDialog";

export function PantryList({ groupId }: { groupId: string }) {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  const [createOpen, setCreateOpen] = useState(false);

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

  // Reads from Dexie, not Supabase — re-renders automatically on local
  // writes (this device) and pulled remote changes alike, so no manual
  // refetch/merge is needed after create/delete.
  const ingredients = useLiveQuery(
    () => fetchIngredients(groupId, communityEnabled),
    [groupId, communityEnabled],
  );
  const loading = ingredients === undefined;
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
      <Stack spacing={1.75} sx={{ p: 2, maxWidth: 480, mx: "auto", pb: 18 }}>
        <Button onClick={() => navigate("/community-pantry")}>
          Browse community pantry
        </Button>

        {isGroupOwner && (
          <Paper
            sx={{
              p: 1,
              borderRadius: "14px",
              boxShadow: tokens.sh2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <FormControlLabel
              // FormControlLabel ships with a default -11px left margin
              // (meant to align a checkbox/radio's own padding with
              // surrounding list text) — overridden to 0 here so the
              // Paper's own left padding actually takes effect instead of
              // being canceled out.
              sx={{ flex: 1, ml: 0, mr: 1 }}
              control={
                <Switch
                  size="small"
                  checked={displayedCommunityEnabled}
                  onChange={(e) => handleCommunityToggle(e.target.checked)}
                  disabled={pendingCommunityEnabled !== null}
                />
              }
              label={
                <Typography fontSize={13}>
                  Use community pantry ingredients in this group
                </Typography>
              }
            />
          </Paper>
        )}
        {communityToggleError && (
          <Alert severity="error">{communityToggleError}</Alert>
        )}

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && ingredients?.length === 0 && (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            This group's pantry is empty. Add the first ingredient to get
            started.
          </Typography>
        )}

        {(ingredients ?? []).map((ingredient) => (
          <IngredientCard
            key={ingredient.id}
            ingredient={ingredient}
            onClick={() => navigate(`${detailPath}/${ingredient.id}`)}
          />
        ))}
      </Stack>

      <FloatingPortal>
        <Fab
          color="primary"
          aria-label="Add ingredient"
          onClick={() => setCreateOpen(true)}
          sx={{
            position: "fixed",
            // Pantry is a bottom-tab root, so it clears BottomNav — see
            // docs/pending-deviations.md (Ticket 16).
            right: 16,
            bottom: 80,
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
        groupId={groupId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setCreateOpen(false)}
      />
    </Box>
  );
}
