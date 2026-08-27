import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { createGroupInvite } from "./api";
import type { GroupInvite } from "../../types/group";

// Owner-only, opened from a GroupCard's invite icon. No /groups/:groupId
// route exists for this ticket (settings beyond basic creation is Ticket
// 13 — see docs/pending-deviations.md, Ticket 11), so invite generation
// lives entirely in this in-place dialog.
export function InviteDialog({
  open,
  groupId,
  groupName,
  userId,
  onClose,
}: {
  open: boolean;
  groupId: string;
  groupName: string;
  userId: string;
  onClose: () => void;
}) {
  const [invite, setInvite] = useState<GroupInvite | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteLink = invite
    ? `${window.location.origin}/invite/${invite.invite_code}`
    : "";

  function handleClose() {
    if (generating) return;
    setInvite(null);
    setError(null);
    setCopied(false);
    onClose();
  }

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const created = await createGroupInvite(groupId, userId);
      setInvite(created);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate an invite code. Try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Invite to {groupName}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!invite ? (
          <DialogContentText>
            Generate a link anyone can use to join this group. It expires in 7
            days and can only be used once.
          </DialogContentText>
        ) : (
          <Stack spacing={2}>
            <DialogContentText>
              Share this link — it expires in 7 days and works for one person
              only.
            </DialogContentText>
            <TextField
              value={inviteLink}
              fullWidth
              slotProps={{
                input: {
                  readOnly: true,
                  endAdornment: (
                    <IconButton
                      aria-label="Copy invite link"
                      onClick={handleCopy}
                      edge="end"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  ),
                },
              }}
            />
            {copied && (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <Alert severity="success" sx={{ py: 0 }}>
                  Link copied
                </Alert>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={generating}>
          Close
        </Button>
        {!invite && (
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? <CircularProgress size={20} /> : "Generate invite"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
