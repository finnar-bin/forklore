import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  clearPendingInviteCode,
  setPendingInviteCode,
} from "../../lib/pendingInviteStorage";
import { useAppStore } from "../../store/useAppStore";
import { acceptGroupInvite, previewGroupInvite } from "./api";

type Status = "loading" | "confirm" | "accepting" | "success" | "error";

const INVALID_MESSAGE = "This invite link is invalid or has expired.";

// Top-level, not nested under /groups — must work for a logged-in user
// clicking a link from anywhere. Public (no RequireAuth) since a
// not-yet-signed-up invitee needs to preview the invite and then be sent
// back here, still logged in, after signup/login — see the logged-out
// branch below and docs/pending-deviations.md ("Remove personal mode") for
// why: without this, an invited user would create their own throwaway
// group during onboarding's now-mandatory group step, then separately
// stumble into the group they were actually invited to, ending up in two.
//
// Previews the invite (read-only, doesn't consume it) before asking the user
// to confirm — accept_group_invite only ever runs from an explicit button
// tap, never automatically on load. See docs/pending-deviations.md (Ticket
// 11 fix, found during review) for why this replaced the original
// auto-accept-on-load behavior: a single-use code was being burned just by
// opening the link, with no chance to see which group it was for or back out.
export function AcceptInvite() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const userId = useAppStore((state) => state.userId);
  const onboardingComplete = useAppStore((state) => state.onboardingComplete);

  const [status, setStatus] = useState<Status>("loading");
  const [groupName, setGroupName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The handoff (setPendingInviteCode, before redirecting to signup/login)
  // has done its job the moment this page renders authenticated again —
  // clear it here regardless of what the user does next, so a stale code
  // can't leak into a later, unrelated signup/login on the same device.
  useEffect(() => {
    if (userId) clearPendingInviteCode();
  }, [userId]);

  useEffect(() => {
    if (!inviteCode) return;
    previewGroupInvite(inviteCode)
      .then((preview) => {
        if (!preview) {
          setError(INVALID_MESSAGE);
          setStatus("error");
          return;
        }
        setGroupName(preview.groupName);
        setStatus("confirm");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : INVALID_MESSAGE);
        setStatus("error");
      });
  }, [inviteCode]);

  async function handleAccept() {
    if (!inviteCode) return;
    setStatus("accepting");
    try {
      await acceptGroupInvite(inviteCode);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : INVALID_MESSAGE);
      setStatus("error");
    }
  }

  // Logged-out at the confirm step: stash the code (consulted by
  // signUpWithEmail/signInWithGoogle's emailRedirectTo/redirectTo, and by
  // LoginForm's post-login navigate) and send them to complete auth, rather
  // than showing a "Join group" button that would just fail against
  // accept_group_invite's auth.uid() requirement.
  function handleAuthRedirect(path: "/signup" | "/login") {
    if (!inviteCode) return;
    setPendingInviteCode(inviteCode);
    navigate(path);
  }

  // Where the exit buttons below (declined, succeeded, or errored) should
  // land — straight to /onboarding rather than /groups if onboarding isn't
  // done yet, since /groups sits behind RequireOnboarded and would just
  // bounce there anyway.
  const postAcceptPath = onboardingComplete ? "/groups" : "/onboarding";
  const postAcceptLabel = onboardingComplete ? "Go to groups" : "Continue";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        sx={{
          p: 4,
          maxWidth: 400,
          width: "100%",
          borderRadius: "14px",
          textAlign: "center",
        }}
      >
        <Stack spacing={2} alignItems="center">
          {status === "loading" && (
            <>
              <CircularProgress />
              <Typography color="text.secondary">Checking invite…</Typography>
            </>
          )}

          {status === "confirm" && userId && (
            <>
              <Typography variant="h6" fontWeight={500}>
                Join {groupName}?
              </Typography>
              <Typography color="text.secondary">
                You'll get full read/write access to this group's shared pantry,
                recipes, and log.
              </Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleAccept}
              >
                Join group
              </Button>
              <Button
                size="large"
                fullWidth
                onClick={() => navigate(postAcceptPath, { replace: true })}
              >
                Not now
              </Button>
            </>
          )}

          {status === "confirm" && !userId && (
            <>
              <Typography variant="h6" fontWeight={500}>
                Join {groupName}?
              </Typography>
              <Typography color="text.secondary">
                Sign up or log in to accept this invite and get full read/write
                access to this group's shared pantry, recipes, and log.
              </Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => handleAuthRedirect("/signup")}
              >
                Sign up to join
              </Button>
              <Button
                size="large"
                fullWidth
                onClick={() => handleAuthRedirect("/login")}
              >
                Log in
              </Button>
            </>
          )}

          {status === "accepting" && (
            <>
              <CircularProgress />
              <Typography color="text.secondary">Joining group…</Typography>
            </>
          )}

          {status === "success" && (
            <>
              <Typography variant="h6" fontWeight={500}>
                You've joined {groupName}
              </Typography>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => navigate(postAcceptPath, { replace: true })}
              >
                {postAcceptLabel}
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <Alert severity="error" sx={{ width: "100%" }}>
                {error}
              </Alert>
              <Button
                variant="outlined"
                size="large"
                fullWidth
                onClick={() =>
                  navigate(userId ? postAcceptPath : "/login", {
                    replace: true,
                  })
                }
              >
                {userId ? postAcceptLabel : "Log in"}
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
