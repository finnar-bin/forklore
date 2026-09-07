import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../theme/theme";

// Same card pattern as LogEntryCard/design-system.md (14px radius, sh2 shadow,
// no visible border when unselected) with a selected state layered on top —
// no radio-card precedent existed when this was added for onboarding; kept
// here (not onboarding-specific) since any feature can reuse it.
export function SelectableCard({
  title,
  description,
  selected,
  onClick,
  trailing,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: selected ? "action.selected" : "background.paper",
        borderRadius: "14px",
        boxShadow: tokens.sh2,
        border: "1.5px solid",
        borderColor: selected ? "primary.main" : "transparent",
        p: 1.5,
        display: "flex",
        gap: 1.5,
        alignItems: "center",
        cursor: "pointer",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {title}
        </Typography>
        {description && (
          <Typography
            sx={{
              fontSize: 12,
              color: "text.secondary",
            }}
          >
            {description}
          </Typography>
        )}
      </Box>
      {trailing && (
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>{trailing}</Box>
      )}
    </Box>
  );
}
