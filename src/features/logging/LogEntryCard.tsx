import type { KeyboardEvent } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../../theme/theme";
import { PhotoThumbnail } from "../../components/PhotoThumbnail";
import { useAppStore } from "../../store/useAppStore";
import type { LogEntry } from "../../types/log";

// Card / list item pattern from design-system.md, applied to Log as
// documented. Log entries have no photo column of their own — the photo, if
// any, is looked up live off the still-existing source ingredient/recipe
// (see useLogEntryPhotos.ts) and falls back to PhotoThumbnail's placeholder
// once that source is deleted or the lookup hasn't resolved yet.
export function LogEntryCard({
  entry,
  subtitle,
  loggedForName,
  photoUrl,
  onClick,
}: {
  entry: LogEntry;
  subtitle: string;
  // Who this entry counts against (entry.logged_for), distinct from whose
  // shared log it's on (entry.group_id) — see docs/pending-deviations.md
  // (Ticket 12 follow-up, "logged by" name, and the later "log for a group
  // member" rework). Optional only because the backing `useProfileNames`
  // lookup can still be mid-flight when this renders, not because any
  // caller ever omits it outright now.
  loggedForName?: string;
  // From useLogEntryPhotos.ts — undefined while the lookup is mid-flight,
  // null once resolved with no photo (or no live source left).
  photoUrl?: string | null;
  onClick?: () => void;
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;
  const sourceLabel = entry.source_recipe_id ? "Recipe" : "Ingredient";
  // Highlights the viewer's own entries in a shared group log, so they're
  // easy to pick out from a fellow member's — see LoggedForSelector.tsx/
  // docs/pending-deviations.md ("log for a group member" rework) for why
  // an entry's logged_for isn't always the viewer.
  const userId = useAppStore((state) => state.userId);
  const isOwnEntry = entry.logged_for === userId;

  // See IngredientCard.tsx's identical handler for why this exists. Only
  // relevant when onClick is actually passed — same conditional this
  // component already applies to `cursor` below.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <Box
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      sx={(theme) => ({
        bgcolor: "background.paper",
        borderRadius: "14px",
        boxShadow: tokens.sh2,
        p: 1.5,
        display: "flex",
        gap: 1.5,
        alignItems: "center",
        cursor: onClick ? "pointer" : undefined,
        ...(onClick && {
          transition: "box-shadow 150ms ease",
          "@media (hover: hover)": {
            "&:hover": { boxShadow: tokens.floating },
          },
          "&:focus": { outline: "none" },
          "&:focus-visible": {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        }),
      })}
    >
      <PhotoThumbnail photoUrl={photoUrl ?? null} alt={entry.name} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            gap: 0.5,
            minWidth: 0,
          }}
        >
          <Typography
            noWrap
            sx={{
              fontSize: 14,
              fontWeight: 500,
              minWidth: 0,
            }}
          >
            {entry.name}
          </Typography>
          <Typography
            noWrap
            sx={{
              fontSize: 12,
              color: "text.secondary",
              flexShrink: 0,
            }}
          >
            {entry.quantity} {entry.unit}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {loggedForName && (
            <Chip
              label={loggedForName}
              size="small"
              color={isOwnEntry ? "secondary" : undefined}
              variant={isOwnEntry ? "filled" : "outlined"}
              sx={{
                height: 18,
                fontSize: 11,
                "& .MuiChip-label": { px: 0.75 },
                ...(isOwnEntry
                  ? {}
                  : { color: "text.secondary", borderColor: "divider" }),
              }}
            />
          )}
          <Typography
            noWrap
            sx={{
              fontSize: 12,
              color: "text.secondary",
            }}
          >
            {subtitle}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography
          sx={{
            fontSize: 14,
            fontWeight: 500,
            color: "primary.main",
          }}
        >
          {entry.kcal.toFixed(2)} kcal
        </Typography>
        <Typography
          sx={{
            fontSize: 11,
            color: "text.secondary",
          }}
        >
          {sourceLabel}
        </Typography>
      </Box>
    </Box>
  );
}
