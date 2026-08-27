import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../../theme/theme";
import { useAppStore } from "../../store/useAppStore";
import { useProfileNames } from "../profiles/useProfileNames";
import {
  deleteGroup,
  fetchGroupMembers,
  fetchMyGroups,
  removeGroupMember,
  updateGroup,
  type GroupInput,
} from "./api";
import { GroupForm } from "./GroupForm";
import { DeleteGroupDialog } from "./DeleteGroupDialog";
import { RemoveMemberDialog } from "./RemoveMemberDialog";
import type { Group, GroupMember } from "../../types/group";

// Owner-only screen (RequireGroupOwner guards the route this is rendered
// under) — rename/edit description, remove a member, delete the group. See
// docs/pending-deviations.md (Ticket 13). Transferring ownership is
// explicitly out of scope per the ticket.
export function GroupSettings({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
  const userId = useAppStore((state) => state.userId);
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  const [group, setGroup] = useState<Group | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [members, setMembers] = useState<GroupMember[] | undefined>(undefined);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<GroupMember | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);

  const [justSaved, setJustSaved] = useState(false);

  // Not read from Dexie (fetchMyGroups is a live Supabase call, same as
  // everywhere else groups are read — see docs/pending-deviations.md,
  // Ticket 11) — this also doubles as this screen's own defense-in-depth
  // check that the caller still owns the group, on top of RequireGroupOwner.
  const loadGroup = useCallback(() => {
    if (!userId) return;
    setLoadError(null);
    fetchMyGroups(userId)
      .then((memberships) => {
        const found = memberships.find((m) => m.group.id === groupId)?.group;
        if (!found) {
          setLoadError("Couldn't find this group.");
          return;
        }
        setGroup(found);
      })
      .catch((err) => {
        setLoadError(
          err instanceof Error ? err.message : "Couldn't load this group.",
        );
      });
  }, [userId, groupId]);

  const loadMembers = useCallback(() => {
    setMembersError(null);
    fetchGroupMembers(groupId)
      .then(setMembers)
      .catch((err) => {
        setMembersError(
          err instanceof Error
            ? err.message
            : "Couldn't load this group's members.",
        );
      });
  }, [groupId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const memberNames = useProfileNames((members ?? []).map((m) => m.user_id));

  async function handleSave(input: GroupInput) {
    const updated = await updateGroup(groupId, input);
    setGroup(updated);
    setJustSaved(true);
  }

  async function handleRemoveMember() {
    if (!removeTarget) return;
    await removeGroupMember(groupId, removeTarget.user_id);
    setRemoveTarget(null);
    loadMembers();
  }

  async function handleDeleteGroup() {
    await deleteGroup(groupId);
    navigate("/groups", { replace: true });
  }

  if (loadError) {
    return (
      <Box sx={{ p: 2, maxWidth: 480, mx: "auto" }}>
        <Alert severity="error">{loadError}</Alert>
      </Box>
    );
  }

  if (!group) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, mx: "auto", pb: 4 }}>
      <Paper sx={{ p: 3, borderRadius: "14px", boxShadow: tokens.sh2 }}>
        <GroupForm
          initialValues={{ name: group.name, description: group.description }}
          submitLabel="Save changes"
          onSubmit={handleSave}
        />
      </Paper>

      <Paper sx={{ p: 2, borderRadius: "14px", boxShadow: tokens.sh2 }}>
        <Typography fontWeight={500} sx={{ mb: 1.5 }}>
          Members
        </Typography>

        {membersError && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {membersError}
          </Alert>
        )}

        {members === undefined && !membersError && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        <Stack divider={<Divider />}>
          {(members ?? []).map((member) => (
            <Box
              key={member.user_id}
              sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontSize={14} noWrap>
                  {memberNames[member.user_id] ?? "Loading…"}
                  {member.user_id === userId ? " (you)" : ""}
                </Typography>
                <Typography fontSize={12} color="text.secondary">
                  {member.role === "owner" ? "Owner" : "Member"}
                </Typography>
              </Box>
              {member.role !== "owner" && (
                <IconButton
                  aria-label={`Remove ${memberNames[member.user_id] ?? "this member"}`}
                  onClick={() => setRemoveTarget(member)}
                >
                  <PersonRemoveIcon />
                </IconButton>
              )}
            </Box>
          ))}
        </Stack>
      </Paper>

      <Button
        color="error"
        variant="outlined"
        size="large"
        onClick={() => setDeleteOpen(true)}
      >
        Delete group
      </Button>

      <RemoveMemberDialog
        open={removeTarget !== null}
        memberName={
          (removeTarget && memberNames[removeTarget.user_id]) || "this member"
        }
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveMember}
      />

      <DeleteGroupDialog
        open={deleteOpen}
        groupName={group.name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteGroup}
      />

      <Snackbar
        open={justSaved}
        autoHideDuration={3000}
        onClose={() => setJustSaved(false)}
        message="Group saved"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
}
