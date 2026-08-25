export interface Group {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  // Owner-controlled opt-in: when true, community pantry ingredients are
  // usable in this group's pantry/recipes/log. See
  // docs/pending-deviations.md ("Community pantry").
  community_pantry_enabled: boolean;
  created_at: string;
}

export type GroupRole = 'owner' | 'member';

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  invited_by: string;
  invite_code: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
}

// A row from the /groups list — the group the caller belongs to, plus their
// own role in it (not a DB table, a query-shaped view built in
// features/groups/api.ts).
export interface GroupMembership {
  group: Group;
  role: GroupRole;
}
