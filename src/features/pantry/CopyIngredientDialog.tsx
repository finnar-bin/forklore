import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useAppStore } from "../../store/useAppStore";
import { copyIngredient } from "../copy/api";
import { CopyTargetList } from "../copy/CopyTargetList";
import { useCopyTargets } from "../copy/useCopyTargets";

// Ingredient copy is direction-agnostic and needs no confirmation beyond
// picking a target — unlike recipe copy, there's no ingredient-matching step
// (see rpcs.md's copy_ingredient). See docs/pending-deviations.md (Ticket 14).
export function CopyIngredientDialog({
  open,
  ingredientId,
  ingredientName,
  groupId,
  isCommunity = false,
  onClose,
  onCopied,
}: {
  open: boolean;
  ingredientId: string;
  ingredientName: string;
  groupId: string | null;
  // See useCopyTargets' isCommunitySource — the community pantry isn't
  // "in" whichever context this dialog happened to be opened from, so
  // nothing gets excluded from the target list on its account. See
  // docs/pending-deviations.md ("Community pantry").
  isCommunity?: boolean;
  onClose: () => void;
  onCopied: () => void;
}) {
  const userId = useAppStore((state) => state.userId);
  const targets = useCopyTargets(open ? userId : null, groupId, isCommunity);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (copying) return;
    setSelectedIndex(null);
    setError(null);
    onClose();
  }

  async function handleCopy() {
    if (!userId || selectedIndex === null || !targets) return;
    const target = targets[selectedIndex];
    setError(null);
    setCopying(true);
    try {
      await copyIngredient(userId, ingredientId, target.groupId);
      setSelectedIndex(null);
      onCopied();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to copy this ingredient. Try again.",
      );
    } finally {
      setCopying(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Copy {ingredientName} to…</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <CopyTargetList
          targets={targets}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={copying}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCopy}
          disabled={selectedIndex === null || copying}
        >
          {copying ? "Copying…" : "Copy ingredient"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
