import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { PhotoThumbnail } from '../../components/PhotoThumbnail';
import type { LogEntry } from '../../types/log';

// Card / list item pattern from design-system.md, applied to Log as
// documented. Log entries have no photo of their own, so the thumbnail
// always renders the generic "no photo" placeholder.
export function LogEntryCard({
  entry,
  subtitle,
  onClick,
}: {
  entry: LogEntry;
  subtitle: string;
  onClick?: () => void;
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;
  const sourceLabel = entry.source_recipe_id ? 'Recipe' : 'Ingredient';

  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: 'background.paper',
        borderRadius: '14px',
        boxShadow: tokens.sh2,
        p: 1.5,
        display: 'flex',
        gap: 1.5,
        alignItems: 'center',
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      <PhotoThumbnail photoUrl={null} alt={entry.snapshot_name} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, minWidth: 0 }}>
          <Typography fontSize={14} fontWeight={500} noWrap sx={{ minWidth: 0 }}>
            {entry.snapshot_name}
          </Typography>
          {entry.snapshot_quantity !== null && (
            <Typography fontSize={12} color="text.secondary" noWrap sx={{ flexShrink: 0 }}>
              {entry.snapshot_quantity} {entry.snapshot_unit}
            </Typography>
          )}
        </Box>
        <Typography fontSize={12} color="text.secondary" noWrap>
          {subtitle}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography fontSize={14} fontWeight={500} color="primary.main">
          {entry.snapshot_kcal.toFixed(0)} kcal
        </Typography>
        <Typography fontSize={11} color="text.secondary">
          {sourceLabel}
        </Typography>
      </Box>
    </Box>
  );
}
