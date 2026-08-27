import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { GroupInput } from "./api";

export function GroupForm({
  initialValues,
  submitLabel,
  onSubmit,
}: {
  initialValues?: GroupInput;
  submitLabel: string;
  onSubmit: (input: GroupInput) => Promise<void>;
}) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        description: description.trim() === "" ? null : description.trim(),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      // try/finally (not just the catch branch) — unlike CreateGroupDialog,
      // which unmounts this form on success, GroupSettings' inline edit
      // keeps it mounted after a successful save, so `submitting` must
      // reset on that path too or the button gets stuck on "Saving…" (same
      // bug shape as IngredientForm's, fixed for RecipeDetail in
      // docs/pending-deviations.md, Ticket 7).
      setSubmitting(false);
    }
  }

  return (
    <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        fullWidth
        autoFocus
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        fullWidth
        multiline
        minRows={2}
      />

      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={submitting || name.trim() === ""}
      >
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </Stack>
  );
}
