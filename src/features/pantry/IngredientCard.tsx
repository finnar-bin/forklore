import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { PhotoThumbnail } from '../../components/PhotoThumbnail';
import type { Ingredient } from '../../types/ingredient';

// Card / list item pattern from design-system.md: thumbnail, title +
// subtitle, primary/secondary metric on the right.
export function IngredientCard({
  ingredient,
  onClick,
}: {
  ingredient: Ingredient;
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
        <Typography fontSize={14} fontWeight={500} noWrap>
          {ingredient.name}
        </Typography>
        <Typography fontSize={12} color="text.secondary" noWrap>
          {ingredient.quantity} {ingredient.unit}
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
