import { db } from "../../lib/db";
import { supabase } from "../../lib/supabase";
import { invalidateMyGroups } from "./useMyGroups";
import { invalidateGroupMembers } from "./useGroupMembers";
import type {
  Group,
  GroupInvite,
  GroupMember,
  GroupMembership,
} from "../../types/group";

export interface GroupInput {
  name: string;
  description: string | null;
}

// Groups aren't wired into the Dexie/outbox pull pattern (frontend-architecture.md's
// Dexie schema lists a `groups` table, but no prior ticket ever pulls into it,
// and "groups I belong to" isn't a single-table query pull.ts's generic scope
// logic covers). This ticket reads/writes groups straight against Supabase —
// see docs/pending-deviations.md (Ticket 11).
export async function fetchMyGroups(
  userId: string,
): Promise<GroupMembership[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("role, groups (*)")
    .eq("user_id", userId);
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const group = Array.isArray(row.groups) ? row.groups[0] : row.groups;
      return group ? { group: group as Group, role: row.role } : null;
    })
    .filter((row): row is GroupMembership => row !== null)
    .sort((a, b) => a.group.name.localeCompare(b.group.name));
}

// Multi-table write (groups + group_members, atomically) — group_members has
// no client-facing insert policy, so this can't be a plain client insert.
// See the create_group RPC and docs/pending-deviations.md (Ticket 11).
export async function createGroup(input: GroupInput): Promise<Group> {
  const { data, error } = await supabase.rpc("create_group", {
    p_name: input.name,
    p_description: input.description,
  });
  if (error) throw error;
  const group = data as Group;
  // Mirrored into Dexie so the type's own home (frontend-architecture.md's
  // schema) at least reflects groups this device has actually seen, even
  // though reads above don't come from Dexie yet.
  await db.groups.put(group);
  // The caller now belongs to a group useMyGroups' shared cache doesn't
  // know about yet — see docs/pending-deviations.md (Ticket 16).
  invalidateMyGroups();
  return group;
}

// Plain insert respecting the "owner creates group invites" RLS policy
// (Ticket 2 migration) — no RPC needed, unlike accept_group_invite, since
// there's nothing multi-table or racy about generating a code.
export async function createGroupInvite(
  groupId: string,
  invitedBy: string,
): Promise<GroupInvite> {
  const { data, error } = await supabase
    .from("group_invites")
    .insert({ group_id: groupId, invited_by: invitedBy })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export interface InvitePreview {
  groupId: string;
  groupName: string;
}

// Read-only preview shown before the invite is actually consumed — see
// preview_group_invite and docs/pending-deviations.md (Ticket 11 fix). Empty
// result (not an exception) means invalid/expired/already-used; the caller
// treats that the same as an accept_group_invite failure.
export async function previewGroupInvite(
  inviteCode: string,
): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc("preview_group_invite", {
    p_invite_code: inviteCode,
  });
  if (error) throw error;
  const row = (data as { group_id: string; group_name: string }[] | null)?.[0];
  return row ? { groupId: row.group_id, groupName: row.group_name } : null;
}

// Plain update — RLS's "owner manages group" policy (schema.md) is
// `using (owner_id = auth.uid())` with no `with check`, so this is a
// straight client update, no RPC needed (rename/description aren't a
// multi-table write). Mirrored into Dexie the same way createGroup already
// does, for the same "at least reflect what this device has seen" reason.
export async function updateGroup(
  groupId: string,
  input: GroupInput,
): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .update({ name: input.name, description: input.description })
    .eq("id", groupId)
    .select("*")
    .single();
  if (error) throw error;
  const group = data as Group;
  await db.groups.put(group);
  // The cached row's group.name/description (embedded via fetchMyGroups'
  // `groups (*)` select) is now stale — see docs/pending-deviations.md
  // (Ticket 16).
  invalidateMyGroups();
  return group;
}

// Standalone, immediate-save setter for the group's community pantry
// opt-in — lives on the group's own pantry screen (PantryList.tsx), not
// GroupSettings/GroupForm, since there's no "Save changes" button on a list
// screen to batch it with. RLS's "owner manages group" policy already
// restricts this to the group's owner, same as updateGroup above. See
// docs/pending-deviations.md ("Community pantry").
export async function setGroupCommunityPantryEnabled(
  groupId: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ community_pantry_enabled: enabled })
    .eq("id", groupId);
  if (error) throw error;
  invalidateMyGroups();
}

// Cascades to group_members/ingredients/recipes/log_entries via the
// `on delete cascade` foreign keys already defined in schema.md — no RPC
// needed, RLS's "owner deletes group" policy covers the row itself.
export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw error;
  await db.groups.delete(groupId);
  // The caller no longer belongs to this group — see
  // docs/pending-deviations.md (Ticket 16).
  invalidateMyGroups();
}

// group_members isn't mirrored in Dexie (same as fetchMyGroups above) — a
// live Supabase read gated by the "members read group membership" RLS
// policy (schema.md, via the is_group_member security-definer helper).
export async function fetchGroupMembers(
  groupId: string,
): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// RLS restricts group_members deletes to the group's owner (schema.md /
// docs/pending-deviations.md, Ticket 2) — plain client delete, no RPC
// needed since removing one membership row isn't a multi-table write.
export async function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
  // The removed row is now stale in useGroupMembers' shared cache (GroupSettings
  // itself re-fetches directly via its own loadMembers, but a mounted
  // /groups/:groupId/log elsewhere in this session isn't otherwise told).
  invalidateGroupMembers();
}

// Returns the joined group's id. rpcs.md's own note says redirect to
// /groups/:groupId/pantry on success — that route doesn't exist until
// Ticket 12, see docs/pending-deviations.md (Ticket 11) for the redirect
// this ticket uses instead.
export async function acceptGroupInvite(inviteCode: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_group_invite", {
    p_invite_code: inviteCode,
  });
  if (error) throw error;
  // The caller now belongs to a group useMyGroups' shared cache doesn't
  // know about yet — see docs/pending-deviations.md (Ticket 16).
  invalidateMyGroups();
  return data as string;
}
