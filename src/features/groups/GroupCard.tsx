import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import GroupIcon from '@mui/icons-material/Group';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import type { GroupMembership } from '../../types/group';

// Card / list item pattern from design-system.md: thumbnail, title +
// subtitle, action on the right. Groups have no photo_url (schema.md), so
// the thumbnail slot always shows the generic placeholder treatment
// (design-system.md "Missing photo state") via a plain group icon tile
// rather than PhotoThumbnail, which is built around ingredient/recipe photos.
export function GroupCard({
  membership,
  onInvite,
}: {
  membership: GroupMembership;
  onInvite: () => void;
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;
  const { group, role } = membership;

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
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: '12px',
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: 'text.secondary',
        }}
      >
        <GroupIcon />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontSize={14} fontWeight={500} noWrap>
          {group.name}
        </Typography>
        <Typography fontSize={12} color="text.secondary" noWrap>
          {group.description || (role === 'owner' ? "You're the owner" : 'Member')}
        </Typography>
      </Box>
      {role === 'owner' && (
        <IconButton aria-label={`Invite someone to ${group.name}`} onClick={onInvite}>
          <PersonAddAltIcon />
        </IconButton>
      )}
    </Box>
  );
}
