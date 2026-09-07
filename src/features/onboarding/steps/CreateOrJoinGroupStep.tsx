import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  acceptGroupInvite,
  createGroup,
  previewGroupInvite,
} from "../../groups/api";
import { GroupForm } from "../../groups/GroupForm";
import type { GroupInput } from "../../groups/api";

type JoinStatus = "idle" | "checking" | "confirm" | "joining" | "joined";

// Mandatory final onboarding step — every account must belong to at least
// one group (see docs/pending-deviations.md, "Remove personal mode").
// Reuses GroupForm directly (not CreateGroupDialog's dialog wrapper, which
// doesn't apply outside a dialog) for creating, and a slim manual
// invite-code entry for joining — the primary "clicked an invite link"
// path is handled before onboarding ever starts (see AcceptInvite.tsx), so
// this join tab is a fallback for a code received out-of-band. Once either
// action succeeds, `createGroup`/`acceptGroupInvite` invalidate the shared
// `useMyGroups` cache themselves — the parent (OnboardingStepper) re-renders
// with `hasGroup` true on its own, no callback needed here.
export function CreateOrJoinGroupStep({ hasGroup }: { hasGroup: boolean }) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [inviteCode, setInviteCode] = useState("");
  const [joinStatus, setJoinStatus] = useState<JoinStatus>("idle");
  const [joinGroupName, setJoinGroupName] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  // `joined` covers the join action's own success independent of `hasGroup`
  // catching up — `acceptGroupInvite` invalidates the shared `useMyGroups`
  // cache, but if that refetch is slow or itself fails, `hasGroup` might
  // never flip, which would otherwise leave this stuck on a disabled
  // "Joining…" button with no way forward.
  if (hasGroup || joinStatus === "joined") {
    return (
      <Stack
        spacing={1.5}
        sx={{
          alignItems: "center",
          py: 2,
        }}
      >
        <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
        <Typography
          sx={{
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          You're in a group — you're all set.
        </Typography>
      </Stack>
    );
  }

  async function handleCreate(input: GroupInput) {
    await createGroup(input);
  }

  async function handleCheckCode() {
    const trimmed = inviteCode.trim();
    if (!trimmed) return;
    setJoinError(null);
    setJoinStatus("checking");
    try {
      const preview = await previewGroupInvite(trimmed);
      if (!preview) {
        setJoinError("This invite code is invalid or has expired.");
        setJoinStatus("idle");
        return;
      }
      setJoinGroupName(preview.groupName);
      setJoinStatus("confirm");
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : "Couldn't check that code.",
      );
      setJoinStatus("idle");
    }
  }

  async function handleJoin() {
    setJoinStatus("joining");
    setJoinError(null);
    try {
      await acceptGroupInvite(inviteCode.trim());
      setJoinStatus("joined");
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : "Couldn't join that group.",
      );
      setJoinStatus("confirm");
    }
  }

  return (
    <Stack spacing={2.5}>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
        }}
      >
        Forklore is shared with a household group — create your own, or join one
        you were invited to.
      </Typography>

      <Tabs
        value={mode}
        onChange={(_, value) => setMode(value)}
        variant="fullWidth"
      >
        <Tab value="create" label="Create a group" />
        <Tab value="join" label="Join with a code" />
      </Tabs>

      {mode === "create" ? (
        <GroupForm submitLabel="Create group" onSubmit={handleCreate} />
      ) : (
        <Stack spacing={2}>
          {joinError && <Alert severity="error">{joinError}</Alert>}

          {joinStatus === "confirm" || joinStatus === "joining" ? (
            <Box>
              <Typography sx={{ mb: 2 }}>Join {joinGroupName}?</Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleJoin}
                disabled={joinStatus === "joining"}
              >
                {joinStatus === "joining" ? "Joining…" : "Join group"}
              </Button>
            </Box>
          ) : (
            <>
              <TextField
                label="Invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                fullWidth
                autoFocus
              />
              <Button
                variant="contained"
                size="large"
                onClick={handleCheckCode}
                disabled={!inviteCode.trim() || joinStatus === "checking"}
              >
                {joinStatus === "checking" ? "Checking…" : "Check code"}
              </Button>
            </>
          )}
        </Stack>
      )}
    </Stack>
  );
}
