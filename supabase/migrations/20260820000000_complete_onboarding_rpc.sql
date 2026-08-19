-- Ticket 5 (onboarding): complete_onboarding RPC. Not part of docs/rpcs.md —
-- added because onboarding submit is a multi-table write (profiles +
-- weight_logs) that must succeed or fail together, per the RPC decision rule
-- in rpcs.md. See docs/pending-deviations.md (Ticket 5).

create or replace function public.complete_onboarding(
  p_name text,
  p_height_cm numeric,
  p_weight_kg numeric,
  p_goal_weight_kg numeric,
  p_goal_type text
)
returns void as $$
begin
  update public.profiles
  set name = p_name,
      height_cm = p_height_cm,
      goal_weight_kg = p_goal_weight_kg,
      goal_type = p_goal_type
  where id = auth.uid();

  insert into public.weight_logs (user_id, weight_kg)
  values (auth.uid(), p_weight_kg);
end;
$$ language plpgsql security definer;
