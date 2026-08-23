-- Optional per-meal kcal breakdown of daily_kcal_target — requested
-- directly, so the calorie target form (onboarding + Progress's
-- EditGoalDialog, both via CalorieTargetStep) can let a caller split their
-- daily target across breakfast/lunch/dinner/snack, and /log +
-- /groups/:groupId/log can show remaining kcal per meal.
--
-- Four separate nullable columns rather than one jsonb blob, matching the
-- flat-column style already used for the rest of the calorie-target fields
-- on this table (daily_kcal_target, goal_pace, etc) — the meal set is fixed
-- (log_entries.meal_type's own enum-like check constraint), so there's no
-- need for jsonb's flexibility.
--
-- All nullable: meal_breakdown_enabled defaults to off, and the four
-- targets stay null until the caller actually turns the switch on and fills
-- them in. Turning the switch back off leaves whatever was last saved in
-- place rather than clearing it — see types/profile.ts's getMealKcalTargets.
alter table public.profiles
  add column meal_breakdown_enabled boolean not null default false,
  add column breakfast_kcal_target numeric,
  add column lunch_kcal_target numeric,
  add column dinner_kcal_target numeric,
  add column snack_kcal_target numeric;

-- complete_onboarding's signature grows from 10 to 15 args — same "drop the
-- old signature first" requirement as the 5 -> 10 arg change in
-- 20260824000000_onboarding_profile_and_calorie_target.sql.
drop function if exists public.complete_onboarding(
  text, date, biological_sex, numeric, numeric, activity_level, goal_type, numeric, goal_pace, numeric
);

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
  p_daily_kcal_target numeric,
  p_meal_breakdown_enabled boolean,
  p_breakfast_kcal_target numeric,
  p_lunch_kcal_target numeric,
  p_dinner_kcal_target numeric,
  p_snack_kcal_target numeric
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
      daily_kcal_target = p_daily_kcal_target,
      meal_breakdown_enabled = p_meal_breakdown_enabled,
      breakfast_kcal_target = p_breakfast_kcal_target,
      lunch_kcal_target = p_lunch_kcal_target,
      dinner_kcal_target = p_dinner_kcal_target,
      snack_kcal_target = p_snack_kcal_target
  where id = auth.uid();

  insert into public.weight_logs (user_id, weight_kg)
  values (auth.uid(), p_weight_kg);
end;
$$ language plpgsql security definer set search_path = public;
