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
  creatorName,
  // Every list of ingredients that can mix community rows in with
  // personal/group ones needs the indicator (PantryList.tsx). The
  // community pantry's own list is 100% community ingredients, so it'd be
  // pure noise there — CommunityPantryList.tsx passes false. See
  // docs/pending-deviations.md ("Community pantry").
  showCommunityIndicator = true,
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
  showCommunityIndicator?: boolean;
  onClick: () => void;
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;
  const kcalPerUnit = ingredient.quantity > 0 ? ingredient.kcal / ingredient.quantity : 0;
  const showIndicator = ingredient.is_community && showCommunityIndicator;

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        bgcolor: 'background.paper',
        borderRadius: '14px',
        boxShadow: tokens.sh2,
        border: showIndicator ? '2px solid' : 'none',
        borderColor: showIndicator ? 'secondary.main' : undefined,
        p: 1.5,
        display: 'flex',
        gap: 1.5,
        alignItems: 'center',
        cursor: 'pointer',
      }}
    >
      {/* Small tab overlapping the card's own top-left corner, in the same
          color as the border — replaces an inline "Community" chip next to
          the name so the indicator reads as a property of the whole card,
          not just its title. See docs/pending-deviations.md ("Community
          pantry"). */}
      {showIndicator && (
        <Box
          sx={{
            position: 'absolute',
            top: -9,
            left: 10,
            bgcolor: 'secondary.main',
            color: 'secondary.contrastText',
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1,
            px: 0.75,
            py: 0.375,
            borderRadius: '4px',
          }}
        >
          Community
        </Box>
      )}
      <PhotoThumbnail photoUrl={ingredient.photo_url} alt={ingredient.name} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontSize={14} fontWeight={500} noWrap>
          {ingredient.name}
        </Typography>
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
