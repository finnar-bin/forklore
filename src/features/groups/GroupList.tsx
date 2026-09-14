import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Fab from "@mui/material/Fab";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import { useAppStore } from "../../store/useAppStore";
import { FloatingPortal } from "../../components/FloatingPortal";
import { PageContent } from "../../components/PageContent";
import { fetchMyGroups } from "./api";
import { GroupCard } from "./GroupCard";
import { CreateGroupDialog } from "./CreateGroupDialog";
import { InviteDialog } from "./InviteDialog";
import type { GroupMembership } from "../../types/group";

export function GroupList({
  createOpen,
  onCreateOpenChange,
}: {
  // "Create group" dialog visibility, lifted to GroupsPage so it can be
  // opened both by this screen's own (mobile-only, <900px) FAB below and by
  // GroupsPage's desktop (>=900px) AppHeader action Button — see
  // docs/pending-deviations.md ("Desktop 'Add' actions move from FAB to
  // header toolbar (issue #65)").
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const userId = useAppStore((state) => state.userId);

  const [groups, setGroups] = useState<GroupMembership[] | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<GroupMembership | null>(
    null,
  );

  // loadGroups is called from two independent sites below (the mount effect
  // and CreateGroupDialog's onCreated) — a single per-effect `cancelled`
  // flag wouldn't cover a call racing another call, only an effect racing
  // its own cleanup. A monotonic request id lets only the most recently
  // started call ever apply its result.
  const requestIdRef = useRef(0);

  const loadGroups = useCallback(() => {
    if (!userId) return;
    const requestId = ++requestIdRef.current;
    setError(null);
    fetchMyGroups(userId)
      .then((result) => {
        if (requestIdRef.current === requestId) setGroups(result);
      })
      .catch((err) => {
        if (requestIdRef.current === requestId) {
          setError(
            err instanceof Error
              ? err.message
              : "Couldn't load your groups. Try again.",
          );
        }
      });
  }, [userId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const loading = groups === undefined && !error;

  return (
    // Root box, not a nested wrapper — see design-system.md's FAB positioning
    // note (same reasoning as RecipeList/PantryList). Also wrapped in
    // FloatingPortal (Ticket 16) — /groups isn't a bottom-tab root so there's
    // no nav bar to clear, but it still sits under AnimatedAppShell's
    // animated transform.
    <Box sx={{ position: "relative", minHeight: "calc(100vh - 64px)" }}>
      <PageContent
        spacing={1.5}
        sx={{
          p: 2,
          pb: "calc(80px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <Stack spacing={0.5} sx={{ mb: 0.5 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 500,
            }}
          >
            Your groups
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
            }}
          >
            Each group shares its own pantry, recipes, and log with everyone in
            it. Tap a group to switch into it, or start a new one.
          </Typography>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && !error && groups?.length === 0 && (
          <Typography
            sx={{
              color: "text.secondary",
              textAlign: "center",
              py: 4,
            }}
          >
            You're not in any groups yet. Create one to share a pantry, recipes,
            and a log with others.
          </Typography>
        )}

        {(groups ?? []).map((membership) => (
          <GroupCard
            key={membership.group.id}
            membership={membership}
            onInvite={() => setInviteTarget(membership)}
          />
        ))}
      </PageContent>

      <FloatingPortal>
        <Fab
          color="primary"
          aria-label="Create group"
          onClick={() => onCreateOpenChange(true)}
          sx={{
            position: "fixed",
            right: 16,
            bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
            // Hidden at >=900px entirely: that width now gets the same
            // action as an AppHeader Button instead (GroupsPage.tsx) — see
            // docs/pending-deviations.md ("Desktop 'Add' actions move from
            // FAB to header toolbar (issue #65)").
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

      <CreateGroupDialog
        open={createOpen}
        onClose={() => onCreateOpenChange(false)}
        onCreated={() => {
          onCreateOpenChange(false);
          loadGroups();
        }}
      />

      {inviteTarget && userId && (
        <InviteDialog
          open
          groupId={inviteTarget.group.id}
          groupName={inviteTarget.group.name}
          userId={userId}
          onClose={() => setInviteTarget(null)}
        />
      )}
    </Box>
  );
}
