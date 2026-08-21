-- Extends onboarding (Ticket 5) to collect the data needed to compute a
-- daily calorie target (Mifflin-St Jeor BMR -> activity-scaled TDEE ->
-- goal-adjusted target), and stores the resulting target on the profile.
-- See docs/pending-deviations.md (Ticket 5) for the full rationale.

-- ============================================================================
-- Enums
-- ============================================================================

-- Converts the existing free-text-with-check goal_type column to a proper
-- enum, same closed-set pattern as ingredient_unit.
create type goal_type as enum ('lose', 'gain', 'maintain');

create type biological_sex as enum ('male', 'female');

create type activity_level as enum (
  'sedentary', 'light', 'moderate', 'very_active', 'extremely_active'
);

create type goal_pace as enum ('steady', 'aggressive', 'custom');

-- ============================================================================
-- profiles
-- ============================================================================

alter table public.profiles drop constraint if exists profiles_goal_type_check;

alter table public.profiles
  alter column goal_type type goal_type using goal_type::goal_type;

alter table public.profiles
  add column birthdate date,
  add column sex biological_sex,
  add column activity_level activity_level,
  add column goal_pace goal_pace,
  add column daily_kcal_target numeric;

-- ============================================================================
-- complete_onboarding RPC
-- ============================================================================

-- Parameter list changed shape (5 args -> 10), so the old signature must be
-- dropped explicitly — `create or replace` would otherwise create a second,
-- overloaded function rather than replacing this one.
drop function if exists public.complete_onboarding(text, numeric, numeric, numeric, text);

create or replace function public.complete_onboarding(
  p_name text,
  p_birthdate date,
  p_sex biological_sex,
  p_height_cm numeric,
  p_weight_kg numeric,
  p_activity_level activity_level,
  p_goal_type goal_type,
  p_goal_weight_kg numeric,
  p_goal_pace goal_pace,
  p_daily_kcal_target numeric
)
returns void as $$
begin
  update public.profiles
  set name = p_name,
      birthdate = p_birthdate,
      sex = p_sex,
      height_cm = p_height_cm,
      activity_level = p_activity_level,
      goal_weight_kg = p_goal_weight_kg,
      goal_type = p_goal_type,
      goal_pace = p_goal_pace,
      daily_kcal_target = p_daily_kcal_target
  where id = auth.uid();

  insert into public.weight_logs (user_id, weight_kg)
  values (auth.uid(), p_weight_kg);
end;
$$ language plpgsql security definer;
