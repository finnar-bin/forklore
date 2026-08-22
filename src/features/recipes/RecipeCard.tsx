import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { PhotoThumbnail } from '../../components/PhotoThumbnail';
import type { Recipe } from '../../types/recipe';

// Card / list item pattern from design-system.md: thumbnail, title +
// subtitle, primary/secondary metric on the right.
export function RecipeCard({
  recipe,
  creatorName,
  onClick,
}: {
  recipe: Recipe;
  // Group context only — see IngredientCard's same prop and
  // docs/pending-deviations.md (Ticket 12).
  creatorName?: string;
  onClick: () => void;
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;
  const perServing = recipe.servings > 0 ? recipe.total_kcal / recipe.servings : 0;

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
      <PhotoThumbnail photoUrl={recipe.photo_url} alt={recipe.name} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontSize={14} fontWeight={500} noWrap>
          {recipe.name}
        </Typography>
        <Typography fontSize={12} color="text.secondary" noWrap>
          {recipe.servings} serving{recipe.servings === 1 ? '' : 's'}
          {creatorName && ` · Added by ${creatorName}`}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography fontSize={14} fontWeight={500} color="primary.main">
          {recipe.total_kcal} kcal
        </Typography>
        <Typography fontSize={11} color="text.secondary">
          {perServing.toFixed(0)}/serving
        </Typography>
      </Box>
    </Box>
  );
}
