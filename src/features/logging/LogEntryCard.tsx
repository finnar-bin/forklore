import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { PhotoThumbnail } from '../../components/PhotoThumbnail';
import type { LogEntry } from '../../types/log';

// Card / list item pattern from design-system.md, applied to Log as
// documented. Log entries have no photo of their own, so the thumbnail
// always renders the generic "no photo" placeholder.
export function LogEntryCard({ entry, subtitle }: { entry: LogEntry; subtitle: string }) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;
  const sourceLabel = entry.source_recipe_id ? 'Recipe' : 'Ingredient';

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: '14px',
        boxShadow: tokens.sh2,
        p: 1.5,
        display: 'flex',
        gap: 1.5,
        alignItems: 'center',
      }}
    >
      <PhotoThumbnail photoUrl={null} alt={entry.snapshot_name} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontSize={14} fontWeight={500} noWrap>
          {entry.snapshot_name}
        </Typography>
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
