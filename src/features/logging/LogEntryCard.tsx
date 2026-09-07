import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../../theme/theme";
import { PhotoThumbnail } from "../../components/PhotoThumbnail";
import type { LogEntry } from "../../types/log";

// Card / list item pattern from design-system.md, applied to Log as
// documented. Log entries have no photo of their own, so the thumbnail
// always renders the generic "no photo" placeholder.
export function LogEntryCard({
  entry,
  subtitle,
  loggedForName,
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
  onClick?: () => void;
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;
  const sourceLabel = entry.source_recipe_id ? "Recipe" : "Ingredient";

  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: "background.paper",
        borderRadius: "14px",
        boxShadow: tokens.sh2,
        p: 1.5,
        display: "flex",
        gap: 1.5,
        alignItems: "center",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      <PhotoThumbnail photoUrl={null} alt={entry.name} />
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
        <Typography
          noWrap
          sx={{
            fontSize: 12,
            color: "text.secondary",
          }}
        >
          {loggedForName && `${loggedForName} · `}
          {subtitle}
        </Typography>
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
