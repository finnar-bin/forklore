import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Group-context-only metadata block for an ingredient/recipe detail screen —
// who created it, and (only once it's actually been edited) who last changed
// it. A row that's never been edited shows its created_at; one that has
// shows updated_at instead, never both — see docs/pending-deviations.md
// (Ticket 12). Names default to "someone" while still loading or if the
// profile lookup comes back empty (e.g. the editor has since left the group).
export function ItemMetadata({
  creatorName,
  createdAt,
  updaterName,
  updatedAt,
  wasUpdated,
}: {
  creatorName: string | undefined;
  createdAt: string;
  updaterName: string | undefined;
  updatedAt: string;
  wasUpdated: boolean;
}) {
  return (
    <Stack spacing={0.25}>
      <Typography fontSize={12} color="text.secondary">
        Added by {creatorName ?? "someone"}
        {!wasUpdated && ` · ${formatDateTime(createdAt)}`}
      </Typography>
      {wasUpdated && (
        <Typography fontSize={12} color="text.secondary">
          Last updated by {updaterName ?? "someone"} ·{" "}
          {formatDateTime(updatedAt)}
        </Typography>
      )}
    </Stack>
  );
}
