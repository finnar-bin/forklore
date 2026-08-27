import { MEAL_TYPES, type MealType } from "../../types/meal";
import type {
  ActivityLevel,
  BiologicalSex,
  GoalPace,
  GoalType,
} from "../../types/profile";

// A "lose" goal weight must actually be below current weight, a "gain" goal
// weight must actually be above it — shared between GoalStep's inline error
// and OnboardingStepper's step-validity gate so both agree on the same rule.
export function isGoalWeightValid(
  goalType: GoalType | "",
  currentWeight: string,
  goalWeight: string,
): boolean {
  if (goalType === "" || goalType === "maintain") return true;
  const current = Number(currentWeight);
  const goal = Number(goalWeight);
  if (!Number.isFinite(current) || !Number.isFinite(goal)) return false;
  return goalType === "lose" ? goal < current : goal > current;
}

// Mifflin-St Jeor BMR -> activity-scaled TDEE -> goal-adjusted target.
// Pure functions only, no I/O — used live by CalorieTargetStep and, in the
// future, by a yearly cron that recomputes daily_kcal_target from the same
// stored inputs as `age` (derived from birthdate) ticks over.

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

// Below this, deficits stop being presented as "steady"/"aggressive" presets
// regardless of what the math says — see AskUserQuestion decision in the plan.
const MIN_SAFE_KCAL: Record<BiologicalSex, number> = {
  male: 1500,
  female: 1200,
};

const KCAL_PER_KG_FAT = 7700;

export function calculateAge(
  birthdate: string,
  today: Date = new Date(),
): number {
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export interface BmrInput {
  sex: BiologicalSex;
  weightKg: number;
  heightCm: number;
  age: number;
}

export function calculateBmr({
  sex,
  weightKg,
  heightCm,
  age,
}: BmrInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function calculateTdee(
  bmr: number,
  activityLevel: ActivityLevel,
): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

export interface CaloriePresetOption {
  pace: "steady" | "aggressive";
  kcal: number;
  weeklyRateKg: number; // negative for lose, positive for gain
  clamped: boolean;
}

export interface CalorieOptions {
  maintenanceKcal: number; // TDEE, always included for reference/summary
  presets: CaloriePresetOption[]; // empty for 'maintain'
}

const PRESET_ADJUSTMENTS: Record<
  "lose" | "gain",
  Record<"steady" | "aggressive", number>
> = {
  lose: { steady: 0.85, aggressive: 0.75 },
  gain: { steady: 1.15, aggressive: 1.25 },
};

export function calculateCalorieOptions(
  tdee: number,
  goalType: GoalType,
  sex: BiologicalSex,
): CalorieOptions {
  const maintenanceKcal = Math.round(tdee);
  if (goalType === "maintain") return { maintenanceKcal, presets: [] };

  const floor = MIN_SAFE_KCAL[sex];
  const adjustments = PRESET_ADJUSTMENTS[goalType];

  const presets = (["steady", "aggressive"] as const).map((pace) => {
    const raw = tdee * adjustments[pace];
    const clamped = goalType === "lose" && raw < floor;
    const kcal = Math.round(clamped ? floor : raw);
    const weeklyRateKg = ((kcal - tdee) * 7) / KCAL_PER_KG_FAT;
    return { pace, kcal, weeklyRateKg, clamped };
  });

  return { maintenanceKcal, presets };
}

// UI-only selection shape — 'maintain' has no equivalent in the goal_pace
// enum (steady/aggressive/custom); resolveCalorieTarget below maps it to a
// null goal_pace. Shared by OnboardingStepper and Progress's
// EditGoalDialog — both let a caller pick from the same CalorieTargetStep
// options and must resolve that pick to the same two DB columns.
export type CalorieSelection = "steady" | "aggressive" | "maintain" | "custom";

export interface ResolvedCalorieTarget {
  goalPace: GoalPace | null;
  dailyKcalTarget: number;
}

export function resolveCalorieTarget(
  selection: CalorieSelection,
  customKcal: string,
  calorieOptions: CalorieOptions,
): ResolvedCalorieTarget | null {
  if (selection === "custom")
    return { goalPace: "custom", dailyKcalTarget: Number(customKcal) };
  if (selection === "maintain")
    return { goalPace: null, dailyKcalTarget: calorieOptions.maintenanceKcal };
  const preset = calorieOptions.presets.find(
    (option) => option.pace === selection,
  );
  if (!preset) return null;
  return { goalPace: preset.pace, dailyKcalTarget: preset.kcal };
}

// Custom target bounds are relative to the person's own TDEE, not a flat
// range — a flat range would happily accept e.g. 4000 kcal for someone whose
// maintenance is 1800. Ceiling is generous (comfortably covers a real bulk)
// but still tied to the person's own numbers, with an absolute backstop
// against typos (an extra trailing digit, etc). The floor here is a hard
// sanity minimum only (real inpatient-supervised protocols don't go below
// this) — MIN_SAFE_KCAL is intentionally NOT enforced as a hard block here,
// since real people (smaller frames, medically supervised diets) do
// legitimately go below the general unsupervised-diet guideline it
// represents; isBelowGeneralGuidance below surfaces it as a warning instead.
const CUSTOM_KCAL_ABSOLUTE_MIN = 500;
const CUSTOM_KCAL_ABSOLUTE_MAX = 10000;
const CUSTOM_KCAL_UPPER_MULTIPLIER = 1.75;

export function getCustomKcalBounds(maintenanceKcal: number): {
  min: number;
  max: number;
} {
  return {
    min: CUSTOM_KCAL_ABSOLUTE_MIN,
    max: Math.min(
      CUSTOM_KCAL_ABSOLUTE_MAX,
      Math.round(maintenanceKcal * CUSTOM_KCAL_UPPER_MULTIPLIER),
    ),
  };
}

export function isCustomKcalValid(
  value: number,
  maintenanceKcal: number,
): boolean {
  const { min, max } = getCustomKcalBounds(maintenanceKcal);
  return Number.isFinite(value) && value >= min && value <= max;
}

// General unsupervised-diet guidance, not a hard limit — see the AskUserQuestion
// decision in the plan for where these two numbers came from. Used only to
// surface a non-blocking warning on a custom target, not to reject it.
export function isBelowGeneralGuidance(
  value: number,
  sex: BiologicalSex,
): boolean {
  return Number.isFinite(value) && value < MIN_SAFE_KCAL[sex];
}

export function getGeneralGuidanceMinimum(sex: BiologicalSex): number {
  return MIN_SAFE_KCAL[sex];
}

// Muscle protein synthesis has a rate limit independent of intake — past a
// certain surplus, extra calories mostly become fat rather than faster
// muscle gain. Not a safety concern (unlike isBelowGeneralGuidance), just a
// diminishing-returns note, so it's non-blocking. The 'aggressive' gain
// preset's own value is used as the threshold: since that's already the
// biggest surplus the app itself suggests, going past it is the natural
// point to flag on a custom entry.
export function isAboveDiminishingReturnsSurplus(
  value: number,
  calorieOptions: CalorieOptions,
): boolean {
  const aggressive = calorieOptions.presets.find(
    (preset) => preset.pace === "aggressive",
  );
  return (
    aggressive !== undefined &&
    Number.isFinite(value) &&
    value > aggressive.kcal
  );
}

// Whatever daily total the caller's current selection actually resolves to
// right now, or null while that's still ambiguous (no selection yet, or a
// custom entry that isn't validly in-range yet) — shared by
// CalorieTargetStep (to know whether the meal-breakdown switch/fields can
// be shown at all) and its two callers (to gate step validity on the same
// number).
export function getResolvedDailyKcal(
  selection: CalorieSelection | "",
  customKcal: string,
  calorieOptions: CalorieOptions | null,
): number | null {
  if (selection === "" || !calorieOptions) return null;
  if (selection === "custom") {
    return isCustomKcalValid(Number(customKcal), calorieOptions.maintenanceKcal)
      ? Number(customKcal)
      : null;
  }
  const resolved = resolveCalorieTarget(selection, customKcal, calorieOptions);
  return resolved ? resolved.dailyKcalTarget : null;
}

// Per-meal kcal breakdown of a daily target — optional (Profile's own
// breakfast/lunch/dinner/snack_kcal_target columns), only meaningful while
// meal_breakdown_enabled is on. Form state for each field is kept as a
// string (mirrors customKcal above) so an empty field reads as "0
// allocated" rather than forcing a value.
export function emptyMealKcalTargets(): Record<MealType, string> {
  return { breakfast: "", lunch: "", dinner: "", snack: "" };
}

export function sumMealKcalTargets(targets: Record<MealType, string>): number {
  return MEAL_TYPES.reduce(
    (sum, meal) => sum + (Number(targets[meal]) || 0),
    0,
  );
}

// Blank fields count as 0 toward the sum — "optional" per meal, but once the
// breakdown switch is on the filled (and implicitly zero) fields must add up
// to exactly the resolved daily total, no more, no less.
export function isMealBreakdownValid(
  enabled: boolean,
  targets: Record<MealType, string>,
  dailyTotal: number | null,
): boolean {
  if (!enabled) return true;
  if (dailyTotal === null) return false;
  const allNonNegative = MEAL_TYPES.every((meal) => {
    if (targets[meal].trim() === "") return true;
    const value = Number(targets[meal]);
    return Number.isFinite(value) && value >= 0;
  });
  // Rounded, not strict ===: kcal targets are always meant to be whole
  // numbers (every display of one elsewhere already rounds via
  // .toFixed(0)), but a typed/pasted non-integer value can still make the
  // sum land a fraction of a kcal off the daily total due to plain binary
  // floating-point rounding, even when the real-arithmetic sum is exact.
  return (
    allNonNegative &&
    Math.round(sumMealKcalTargets(targets)) === Math.round(dailyTotal)
  );
}

// Converts validated string form state to the numbers actually written to
// Profile's breakfast/lunch/dinner/snack_kcal_target columns — only called
// once isMealBreakdownValid confirms the fields are ready to save.
export function mealKcalTargetsToNumbers(
  targets: Record<MealType, string>,
): Record<MealType, number> {
  return {
    breakfast: Number(targets.breakfast) || 0,
    lunch: Number(targets.lunch) || 0,
    dinner: Number(targets.dinner) || 0,
    snack: Number(targets.snack) || 0,
  };
}
