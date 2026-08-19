-- Fixes "infinite recursion detected in policy for relation group_members".
--
-- "members read group membership" (on group_members) queried group_members
-- from inside its own USING clause; evaluating that subquery re-triggers the
-- same policy, forever. "read own or group-mate profiles" (on profiles)
-- self-joined group_members twice, which hit the same recursive policy.
--
-- Fix: security definer helper functions run as the table owner, which
-- bypasses RLS on the tables they query (same pattern as accept_group_invite
-- etc. in the Ticket 2 migration) — breaking the self-reference.

create or replace function public.is_group_member(p_group_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function public.shares_group_with(p_user_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.group_members gm1
    join public.group_members gm2 on gm2.group_id = gm1.group_id
    where gm1.user_id = auth.uid() and gm2.user_id = p_user_id
  );
$$ language sql security definer stable;

alter policy "members read group membership"
on public.group_members
using (public.is_group_member(group_id));

alter policy "read own or group-mate profiles"
on public.profiles
using (
  id = auth.uid()
  or public.shares_group_with(id)
);
