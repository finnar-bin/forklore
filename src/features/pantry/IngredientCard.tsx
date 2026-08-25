import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { PhotoThumbnail } from '../../components/PhotoThumbnail';
import type { Ingredient } from '../../types/ingredient';

// Card / list item pattern from design-system.md: thumbnail, title +
// subtitle, primary/secondary metric on the right.
export function IngredientCard({
  ingredient,
  creatorName,
  onClick,
}: {
  ingredient: Ingredient;
  // Shown whenever known: group context always (design-system.md's card
  // subtitle pattern — "quantity+who added it" — see
  // docs/pending-deviations.md, Ticket 12), and personal context too when
  // this is a community ingredient (its creator isn't necessarily "you" —
  // see docs/pending-deviations.md, "Community pantry"). Undefined while
  // still loading either way, so the subtitle just omits the clause rather
  // than showing a placeholder.
  creatorName?: string;
  onClick: () => void;
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;
  const kcalPerUnit = ingredient.quantity > 0 ? ingredient.kcal / ingredient.quantity : 0;

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
        cursor: 'pointer',
      }}
    >
      <PhotoThumbnail photoUrl={ingredient.photo_url} alt={ingredient.name} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography fontSize={14} fontWeight={500} noWrap>
            {ingredient.name}
          </Typography>
          {ingredient.is_community && (
            <Chip label="Community" size="small" color="secondary" sx={{ height: 18, fontSize: 10 }} />
          )}
        </Stack>
        <Typography fontSize={12} color="text.secondary" noWrap>
          {ingredient.quantity} {ingredient.unit}
          {creatorName && ` · Added by ${creatorName}`}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography fontSize={14} fontWeight={500} color="primary.main">
          {ingredient.kcal} kcal
        </Typography>
        <Typography fontSize={11} color="text.secondary">
          {kcalPerUnit.toFixed(2)}/{ingredient.unit}
        </Typography>
      </Box>
    </Box>
  );
}
