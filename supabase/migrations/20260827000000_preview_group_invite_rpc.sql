-- Ticket 11 fix (found during review): lets the invite screen show which
-- group an invite code leads to *before* consuming it. Read-only — no lock,
-- no state change. security definer because the invitee isn't a group
-- member yet, so plain RLS blocks both `group_invites` (owner-only select)
-- and `groups` (members-only select) for them. See docs/pending-deviations.md
-- (Ticket 11).
--
-- Returns zero rows (not an exception) for an invalid/expired/already-used
-- code — the caller treats an empty result the same as accept_group_invite's
-- "Invalid or expired invite code" error, without needing to parse a
-- Postgres exception message for what is, here, just "nothing to preview."

create or replace function public.preview_group_invite(p_invite_code text)
returns table(group_id uuid, group_name text) as $$
  select g.id, g.name
  from public.group_invites gi
  join public.groups g on g.id = gi.group_id
  where gi.invite_code = p_invite_code
    and gi.accepted_at is null
    and gi.expires_at > now();
$$ language sql stable security definer;
