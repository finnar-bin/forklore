-- Ticket 11: Group CRUD, membership, and invites.
-- Deploys accept_group_invite exactly as specified in docs/rpcs.md (tables +
-- RLS already exist from the Ticket 2 migration), plus a new create_group RPC
-- not documented anywhere in rpcs.md — see docs/pending-deviations.md
-- (Ticket 11) for why it's needed.

-- ============================================================================
-- create_group
-- ============================================================================
-- Atomically creates a group and adds the caller as its owner. Required
-- because public.group_members has no client-facing insert policy (per the
-- Ticket 2 migration's own comment: membership rows are only ever created by
-- a security definer flow) — a plain client-side insert into public.groups
-- followed by a plain insert into public.group_members would fail on the
-- second step. Mirrors accept_group_invite's security definer pattern.

create or replace function public.create_group(p_name text, p_description text)
returns public.groups as $$
declare
  v_group public.groups;
begin
  insert into public.groups (name, description, owner_id)
  values (p_name, p_description, auth.uid())
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'owner');

  return v_group;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- accept_group_invite
-- ============================================================================
-- Verbatim from docs/rpcs.md. The `for update` row lock is what actually
-- enforces single-use — it prevents two simultaneous acceptances of the same
-- code from both succeeding.

create or replace function public.accept_group_invite(p_invite_code text)
returns uuid as $$
declare
  v_invite record;
begin
  select * into v_invite from public.group_invites
  where invite_code = p_invite_code
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_invite.group_id, auth.uid(), 'member');

  update public.group_invites
  set accepted_by = auth.uid(), accepted_at = now()
  where id = v_invite.id;

  return v_invite.group_id;
end;
$$ language plpgsql security definer;
