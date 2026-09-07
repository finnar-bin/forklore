import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupIcon from "@mui/icons-material/Group";
import { useColorScheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import { setStoredGroupId } from "../../lib/activeGroupStorage";
import { shadows } from "../../theme/theme";
import type { GroupMembership } from "../../types/group";

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
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;
  const navigate = useNavigate();
  const { group, role } = membership;

  // The only way to switch groups now (Pantry/Recipes' own ContextSwitcher
  // chip was removed, requested directly) — persist the pick (so
  // BottomNav/the "/" redirect land back here next time, see
  // resolveDefaultGroupId) and jump into this group's pantry.
  function selectGroup() {
    setStoredGroupId(group.id);
    navigate(`/groups/${group.id}/pantry`);
  }

  return (
    <Box
      onClick={selectGroup}
      sx={{
        bgcolor: "background.paper",
        borderRadius: "14px",
        boxShadow: tokens.sh2,
        p: 1.5,
        display: "flex",
        gap: 1.5,
        alignItems: "center",
        cursor: "pointer",
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: "12px",
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "text.secondary",
        }}
      >
        <GroupIcon />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          noWrap
          sx={{
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {group.name}
        </Typography>
        <Typography
          noWrap
          sx={{
            fontSize: 12,
            color: "text.secondary",
          }}
        >
          {group.description ||
            (role === "owner" ? "You're the owner" : "Member")}
        </Typography>
      </Box>
      {role === "owner" && (
        <IconButton
          aria-label={`Invite someone to ${group.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onInvite();
          }}
        >
          <PersonAddAltIcon />
        </IconButton>
      )}
      {/* Only real entry point to /groups/:groupId/settings — hidden for
          non-owners per this ticket's acceptance criteria (RequireGroupOwner
          also enforces this server-side-backed check if the URL is typed
          directly). See docs/pending-deviations.md (Ticket 13). */}
      {role === "owner" && (
        <IconButton
          aria-label={`${group.name} settings`}
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/groups/${group.id}/settings`);
          }}
        >
          <SettingsIcon />
        </IconButton>
      )}
    </Box>
  );
}
