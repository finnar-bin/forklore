import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useColorScheme } from "@mui/material/styles";
import { db } from "../../lib/db";
import { discardFailedItem, retryFailedItem } from "../../sync/outbox";
import { shadows } from "../../theme/theme";
import type { OutboxItem } from "../../types/sync";

const OPERATION_LABEL: Record<OutboxItem["operation"], string> = {
  insert: "Add",
  update: "Update",
  delete: "Delete",
};

function describeItem(item: OutboxItem): string {
  return `${OPERATION_LABEL[item.operation]} in ${item.table.replace(/_/g, " ")}`;
}

// Card pattern from design-system.md (sh2 shadow, 14px radius) with a status
// color accent — secondary (amber) for the informational, self-resolving
// state, error (red) for the state that needs the user's attention.
function SyncItemCard({
  item,
  tone,
  detail,
  action,
}: {
  item: OutboxItem;
  tone: "warning" | "error";
  detail: string;
  action?: ReactNode;
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderRadius: "14px",
        boxShadow: tokens.sh2,
        p: 1.5,
        pl: 1.75,
        borderLeft: "3px solid",
        borderLeftColor: tone === "error" ? "error.main" : "secondary.main",
      }}
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            noWrap
            sx={{
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {describeItem(item)}
          </Typography>
          <Typography
            sx={{
              fontSize: 12,
              color: "text.secondary",
            }}
          >
            {detail}
          </Typography>
        </Box>
        {action}
      </Stack>
    </Box>
  );
}

export function SyncStatusList() {
  const items = useLiveQuery(() => db.outbox.toArray(), []);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { waiting, failed } = useMemo(() => {
    const all = items ?? [];
    return {
      waiting: all.filter((item) => item.status === "waiting_for_connectivity"),
      failed: all.filter((item) => item.status === "failed"),
    };
  }, [items]);

  async function handleRetry(itemId: string) {
    setBusyId(itemId);
    try {
      await retryFailedItem(itemId);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDiscard(itemId: string) {
    setBusyId(itemId);
    try {
      await discardFailedItem(itemId);
    } finally {
      setBusyId(null);
    }
  }

  if (items === undefined) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (waiting.length === 0 && failed.length === 0) {
    return (
      <Typography
        sx={{
          color: "text.secondary",
          textAlign: "center",
          py: 4,
        }}
      >
        Everything's synced. No outstanding changes.
      </Typography>
    );
  }

  return (
    <Stack spacing={3} sx={{ p: 2, maxWidth: 480, mx: "auto", pb: 4 }}>
      {failed.length > 0 && (
        <Stack spacing={1.5}>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 500,
              color: "text.secondary",
            }}
          >
            Needs attention
          </Typography>
          {failed.map((item) => (
            <SyncItemCard
              key={item.id}
              item={item}
              tone="error"
              detail={item.error ?? "Couldn't save this change."}
              action={
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <Button
                    size="small"
                    onClick={() => handleRetry(item.id)}
                    disabled={busyId === item.id}
                  >
                    Retry now
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleDiscard(item.id)}
                    disabled={busyId === item.id}
                  >
                    Discard
                  </Button>
                </Stack>
              }
            />
          ))}
        </Stack>
      )}

      {waiting.length > 0 && (
        <Stack spacing={1.5}>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 500,
              color: "text.secondary",
            }}
          >
            Waiting for connection
          </Typography>
          {waiting.map((item) => (
            <SyncItemCard
              key={item.id}
              item={item}
              tone="warning"
              detail="Will retry automatically once you're back online."
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
