import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { SelectableCard } from '../../components/SelectableCard';
import {
  calculateAge,
  calculateBmr,
  calculateCalorieOptions,
  calculateTdee,
  getResolvedDailyKcal,
  isCustomKcalValid,
  isGoalWeightValid,
  isMealBreakdownValid,
  mealKcalTargetsToNumbers,
  resolveCalorieTarget,
  type CalorieSelection,
} from '../onboarding/calorieCalc';
import { GOAL_TYPES } from '../onboarding/onboardingOptions';
import { CalorieTargetStep } from '../onboarding/steps/CalorieTargetStep';
import { updateGoal } from './api';
import { getMealKcalTargets, type GoalType, type Profile } from '../../types/profile';
import type { MealType } from '../../types/meal';

const STEP_LABELS = ['Goal', 'Calorie target'];

// 'custom' is valid for any goal type; 'maintain' only pairs with a
// 'maintain' goalType, 'steady'/'aggressive' only with lose/gain — see
// effectiveSelection's own comment for why this matters.
function isSelectionValidForGoalType(selection: CalorieSelection | '', goalType: GoalType): boolean {
  if (selection === '') return false;
  if (selection === 'custom') return true;
  if (selection === 'maintain') return goalType === 'maintain';
  return goalType !== 'maintain';
}

// Two steps mirroring onboarding's own Goal + Calorie target steps (per
// direct request — "similar to the whole onboarding experience") rather
// than just the goal-type/weight fields this dialog originally had.
// Doesn't re-collect sex/activity level/height — those are already on the
// profile from onboarding, so the calorie step below re-derives from them
// instead of asking again.
export function EditGoalDialog({
  open,
  userId,
  profile,
  currentWeight,
  onClose,
  onSaved,
}: {
  open: boolean;
  userId: string;
  profile: Profile;
  // For goal-weight validation (must be below/above this) and as the
  // "current weight" input to the same BMR calculation onboarding used —
  // null skips both (no weight logged yet), which shouldn't happen once
  // onboarding requires an initial entry, but this screen doesn't assume it.
  currentWeight: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      {/* Mounted only while open, same reasoning as LogWeightDialog — form
          state starts fresh (from the current profile) each time. */}
      {open && (
        <EditGoalForm userId={userId} profile={profile} currentWeight={currentWeight} onSaved={onSaved} />
      )}
    </Dialog>
  );
}

function EditGoalForm({
  userId,
  profile,
  currentWeight,
  onSaved,
}: {
  userId: string;
  profile: Profile;
  currentWeight: number | null;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<0 | 1>(0);
  const [goalType, setGoalType] = useState<GoalType>(profile.goal_type ?? 'maintain');
  const [goalWeight, setGoalWeight] = useState(
    profile.goal_weight_kg !== null ? String(profile.goal_weight_kg) : '',
  );
  // Pre-filled from the caller's existing goal_pace/daily_kcal_target
  // (rather than starting blank like onboarding does) — editing an
  // existing goal shouldn't force re-picking a calorie target that isn't
  // actually changing.
  const [calorieSelection, setCalorieSelection] = useState<CalorieSelection | ''>(() => {
    if (profile.goal_pace === 'custom') return 'custom';
    if (profile.goal_pace === 'steady' || profile.goal_pace === 'aggressive') return profile.goal_pace;
    if (profile.goal_type === 'maintain') return 'maintain';
    return '';
  });
  const [customKcal, setCustomKcal] = useState(
    profile.goal_pace === 'custom' && profile.daily_kcal_target !== null ? String(profile.daily_kcal_target) : '',
  );
  const [mealBreakdownEnabled, setMealBreakdownEnabled] = useState(profile.meal_breakdown_enabled);
  const [mealKcalTargets, setMealKcalTargets] = useState<Record<MealType, string>>(() => {
    const targets = getMealKcalTargets(profile);
    return {
      breakfast: targets.breakfast !== null ? String(targets.breakfast) : '',
      lunch: targets.lunch !== null ? String(targets.lunch) : '',
      dinner: targets.dinner !== null ? String(targets.dinner) : '',
      snack: targets.snack !== null ? String(targets.snack) : '',
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsGoalWeight = goalType === 'lose' || goalType === 'gain';
  const goalWeightEntered = goalWeight.trim() !== '';
  const goalWeightError =
    needsGoalWeight && goalWeightEntered && currentWeight !== null
      && !isGoalWeightValid(goalType, String(currentWeight), goalWeight)
      ? goalType === 'lose'
        ? 'Goal weight should be lower than your current weight'
        : 'Goal weight should be higher than your current weight'
      : null;
  const step1Valid = !needsGoalWeight || (goalWeightEntered && goalWeightError === null);

  const age = profile.birthdate ? calculateAge(profile.birthdate) : null;
  // Same inputs onboarding's own BMR/TDEE calculation used — all already on
  // file post-onboarding (sex, activity level, height) plus the caller's
  // latest logged weight, re-derived here rather than re-asked. Bundles
  // `sex` alongside `options` so CalorieTargetStep gets a properly narrowed
  // non-null value instead of a manual assertion.
  const calorieContext = useMemo(() => {
    if (age === null || !profile.sex || !profile.activity_level || !profile.height_cm || currentWeight === null) {
      return null;
    }
    const bmr = calculateBmr({ sex: profile.sex, weightKg: currentWeight, heightCm: profile.height_cm, age });
    const tdee = calculateTdee(bmr, profile.activity_level);
    return { sex: profile.sex, options: calculateCalorieOptions(tdee, goalType, profile.sex) };
  }, [age, profile.sex, profile.activity_level, profile.height_cm, currentWeight, goalType]);

  // A selection carried over from before a goalType change can point at an
  // option that no longer exists — switching from lose/gain to maintain
  // leaves e.g. 'steady' selected even though maintain's CalorieTargetStep
  // only ever renders a single "Maintain your weight" card, with nothing
  // visibly highlighted. Deriving (rather than clearing via an effect)
  // means the original lose/gain pick reappears automatically if the user
  // flips goalType back, instead of being lost. `resolveCalorieTarget`
  // would otherwise return null for a stale non-custom selection (no
  // matching preset), which handleSave already treats as "nothing changed"
  // — but step2Valid must agree, or "Save goal" stays enabled with no
  // visible selection and silently keeps the old target.
  const effectiveSelection: CalorieSelection | '' = isSelectionValidForGoalType(calorieSelection, goalType)
    ? calorieSelection
    : '';

  const dailyTotal = calorieContext ? getResolvedDailyKcal(effectiveSelection, customKcal, calorieContext.options) : null;

  // No calorie suggestions to validate when calorieContext is null (missing
  // profile data) — handleSave below keeps the existing goal_pace/
  // daily_kcal_target unchanged in that case, so there's nothing to block.
  const step2Valid =
    calorieContext === null ||
    (effectiveSelection !== '' &&
      (effectiveSelection !== 'custom' ||
        isCustomKcalValid(Number(customKcal), calorieContext.options.maintenanceKcal)) &&
      isMealBreakdownValid(mealBreakdownEnabled, mealKcalTargets, dailyTotal));

  async function handleSave() {
    setError(null);
    setSubmitting(true);
    try {
      let goalPace = profile.goal_pace;
      let dailyKcalTarget = profile.daily_kcal_target;
      if (calorieContext && effectiveSelection !== '') {
        const resolved = resolveCalorieTarget(effectiveSelection, customKcal, calorieContext.options);
        if (resolved) {
          goalPace = resolved.goalPace;
          dailyKcalTarget = resolved.dailyKcalTarget;
        }
      }
      await updateGoal(userId, {
        goalType,
        goalWeightKg: needsGoalWeight ? Number(goalWeight) : null,
        goalPace,
        dailyKcalTarget,
        mealBreakdownEnabled,
        mealKcalTargets: mealBreakdownEnabled ? mealKcalTargetsToNumbers(mealKcalTargets) : null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogTitle>{step === 0 ? 'Edit goal' : 'Daily calorie target'}</DialogTitle>
      <DialogContent sx={{ pt: '12px !important' }}>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography fontSize={12} color="text.secondary">
            Step {step + 1} of {STEP_LABELS.length} · {STEP_LABELS[step]}
          </Typography>

          {step === 0 && (
            <Stack spacing={2.5}>
              <Stack spacing={1}>
                {GOAL_TYPES.map((option) => (
                  <SelectableCard
                    key={option.value}
                    title={option.label}
                    selected={goalType === option.value}
                    onClick={() => setGoalType(option.value)}
                  />
                ))}
              </Stack>

              {needsGoalWeight && (
                <TextField
                  label="Goal weight (kg)"
                  type="number"
                  value={goalWeight}
                  onChange={(e) => setGoalWeight(e.target.value)}
                  required
                  fullWidth
                  autoFocus
                  error={goalWeightError !== null}
                  helperText={goalWeightError}
                  slotProps={{ htmlInput: { min: 20, max: 400, step: 0.1 } }}
                />
              )}
            </Stack>
          )}

          {step === 1 &&
            (calorieContext ? (
              <CalorieTargetStep
                goalType={goalType}
                sex={calorieContext.sex}
                calorieOptions={calorieContext.options}
                selection={effectiveSelection}
                onSelectionChange={setCalorieSelection}
                customKcal={customKcal}
                onCustomKcalChange={setCustomKcal}
                mealBreakdownEnabled={mealBreakdownEnabled}
                onMealBreakdownEnabledChange={setMealBreakdownEnabled}
                mealKcalTargets={mealKcalTargets}
                onMealKcalTargetChange={(meal, value) =>
                  setMealKcalTargets((prev) => ({ ...prev, [meal]: value }))
                }
              />
            ) : (
              <Alert severity="info">
                We don't have enough profile info (height, activity level, or a logged weight) to suggest a calorie
                target right now — your existing target will be kept as-is.
              </Alert>
            ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        {step === 1 && (
          <Button onClick={() => setStep(0)} disabled={submitting}>
            Back
          </Button>
        )}
        {step === 0 ? (
          <Button variant="contained" onClick={() => setStep(1)} disabled={!step1Valid}>
            Continue
          </Button>
        ) : (
          <Button variant="contained" onClick={handleSave} disabled={!step2Valid || submitting}>
            {submitting ? 'Saving…' : 'Save goal'}
          </Button>
        )}
      </DialogActions>
    </>
  );
}
