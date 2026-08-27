import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { logWeight } from "./api";
import type { WeightLog } from "../../types/weight";

// No date field — `logged_at` defaults to `current_date` (schema.md), and
// nothing in the ticket calls for backdating a past weigh-in.
export function LogWeightDialog({
  open,
  userId,
  onClose,
  onLogged,
}: {
  open: boolean;
  userId: string;
  onClose: () => void;
  onLogged: (log: WeightLog) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Log weight</DialogTitle>
      {/* Mounted only while open, same reasoning as AddLogEntryDialog — form
          state starts fresh each time. */}
      {open && <LogWeightForm userId={userId} onLogged={onLogged} />}
    </Dialog>
  );
}

function LogWeightForm({
  userId,
  onLogged,
}: {
  userId: string;
  onLogged: (log: WeightLog) => void;
}) {
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const log = await logWeight(userId, Number(weight));
      onLogged(log);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <DialogContent sx={{ pt: "12px !important" }}>
      <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
        {error && <Alert severity="error">{error}</Alert>}

        <TextField
          label="Weight (kg)"
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          required
          fullWidth
          autoFocus
          slotProps={{ htmlInput: { min: 20, max: 400, step: 0.1 } }}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={submitting || weight.trim() === ""}
        >
          {submitting ? "Saving…" : "Log weight"}
        </Button>
      </Stack>
    </DialogContent>
  );
}
