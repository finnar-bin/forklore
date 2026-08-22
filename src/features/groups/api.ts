import { db } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import type { Group, GroupInvite, GroupMembership } from '../../types/group';

export interface GroupInput {
  name: string;
  description: string | null;
}

// Groups aren't wired into the Dexie/outbox pull pattern (frontend-architecture.md's
// Dexie schema lists a `groups` table, but no prior ticket ever pulls into it,
// and "groups I belong to" isn't a single-table query pull.ts's generic scope
// logic covers). This ticket reads/writes groups straight against Supabase —
// see docs/pending-deviations.md (Ticket 11).
export async function fetchMyGroups(userId: string): Promise<GroupMembership[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('role, groups (*)')
    .eq('user_id', userId);
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
  const { data, error } = await supabase.rpc('create_group', {
    p_name: input.name,
    p_description: input.description,
  });
  if (error) throw error;
  const group = data as Group;
  // Mirrored into Dexie so the type's own home (frontend-architecture.md's
  // schema) at least reflects groups this device has actually seen, even
  // though reads above don't come from Dexie yet.
  await db.groups.put(group);
  return group;
}

// Plain insert respecting the "owner creates group invites" RLS policy
// (Ticket 2 migration) — no RPC needed, unlike accept_group_invite, since
// there's nothing multi-table or racy about generating a code.
export async function createGroupInvite(groupId: string, invitedBy: string): Promise<GroupInvite> {
  const { data, error } = await supabase
    .from('group_invites')
    .insert({ group_id: groupId, invited_by: invitedBy })
    .select('*')
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
export async function previewGroupInvite(inviteCode: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('preview_group_invite', {
    p_invite_code: inviteCode,
  });
  if (error) throw error;
  const row = (data as { group_id: string; group_name: string }[] | null)?.[0];
  return row ? { groupId: row.group_id, groupName: row.group_name } : null;
}

// Returns the joined group's id. rpcs.md's own note says redirect to
// /groups/:groupId/pantry on success — that route doesn't exist until
// Ticket 12, see docs/pending-deviations.md (Ticket 11) for the redirect
// this ticket uses instead.
export async function acceptGroupInvite(inviteCode: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_group_invite', {
    p_invite_code: inviteCode,
  });
  if (error) throw error;
  return data as string;
}
