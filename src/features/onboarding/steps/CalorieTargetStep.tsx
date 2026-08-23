import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { SelectableCard } from '../../../components/SelectableCard';
import {
  getCustomKcalBounds,
  getGeneralGuidanceMinimum,
  isAboveDiminishingReturnsSurplus,
  isBelowGeneralGuidance,
  isCustomKcalValid,
  type CalorieOptions,
  type CalorieSelection,
} from '../calorieCalc';
import type { BiologicalSex, GoalType } from '../../../types/profile';

// Re-exported so existing `import { type CalorieSelection } from
// './steps/CalorieTargetStep'` call sites (OnboardingStepper) don't need to
// change — the type itself now lives in calorieCalc.ts alongside
// resolveCalorieTarget, which needs it too and can't import this file
// without a circular dependency (this file already imports calorieCalc.ts).
export type { CalorieSelection };

const PACE_LABELS: Record<'steady' | 'aggressive', string> = {
  steady: 'Steady',
  aggressive: 'Aggressive',
};

function rateDescription(goalType: GoalType, weeklyRateKg: number, clamped: boolean): string {
  const verb = goalType === 'lose' ? 'Lose' : 'Gain';
  const rate = `${verb} ~${Math.abs(weeklyRateKg).toFixed(1)} kg/week`;
  return clamped ? `${rate} · adjusted to a safe minimum` : rate;
}

export function CalorieTargetStep({
  goalType,
  sex,
  calorieOptions,
  selection,
  onSelectionChange,
  customKcal,
  onCustomKcalChange,
}: {
  goalType: GoalType;
  sex: BiologicalSex;
  calorieOptions: CalorieOptions;
  selection: CalorieSelection | '';
  onSelectionChange: (value: CalorieSelection) => void;
  customKcal: string;
  onCustomKcalChange: (value: string) => void;
}) {
  const { min: customMin, max: customMax } = getCustomKcalBounds(calorieOptions.maintenanceKcal);
  const customValue = Number(customKcal);
  const customEntered = customKcal.trim() !== '';
  const customError =
    selection === 'custom' && customEntered && !isCustomKcalValid(customValue, calorieOptions.maintenanceKcal)
      ? `Enter a value between ${customMin} and ${customMax} kcal`
      : null;
  const showsBelowGuidanceWarning =
    selection === 'custom' && customEntered && customError === null && isBelowGeneralGuidance(customValue, sex);
  const showsDiminishingReturnsNote =
    goalType === 'gain' &&
    selection === 'custom' &&
    customEntered &&
    customError === null &&
    isAboveDiminishingReturnsSurplus(customValue, calorieOptions);

  return (
    <Stack spacing={1.5} sx={{ pt: 1 }}>
      {goalType === 'maintain' ? (
        <SelectableCard
          title="Maintain your weight"
          description="Keeps your weight steady based on your stats."
          selected={selection === 'maintain'}
          onClick={() => onSelectionChange('maintain')}
          trailing={
            <Typography fontSize={14} fontWeight={500} color="primary.main">
              {calorieOptions.maintenanceKcal} kcal/day
            </Typography>
          }
        />
      ) : (
        calorieOptions.presets.map((preset) => (
          <SelectableCard
            key={preset.pace}
            title={PACE_LABELS[preset.pace]}
            description={rateDescription(goalType, preset.weeklyRateKg, preset.clamped)}
            selected={selection === preset.pace}
            onClick={() => onSelectionChange(preset.pace)}
            trailing={
              <Typography fontSize={14} fontWeight={500} color="primary.main">
                {preset.kcal} kcal/day
              </Typography>
            }
          />
        ))
      )}

      <SelectableCard
        title="Set your own target"
        description="Enter a specific daily calorie target instead."
        selected={selection === 'custom'}
        onClick={() => onSelectionChange('custom')}
      />

      {selection === 'custom' && (
        <>
          <TextField
            label="Daily calorie target (kcal)"
            type="number"
            value={customKcal}
            onChange={(e) => onCustomKcalChange(e.target.value)}
            required
            fullWidth
            error={customError !== null}
            helperText={customError ?? `Between ${customMin} and ${customMax} kcal`}
            slotProps={{ htmlInput: { min: customMin, max: customMax, step: 1 } }}
          />
          {showsBelowGuidanceWarning && (
            <Alert severity="warning">
              This is below the {getGeneralGuidanceMinimum(sex)} kcal/day general guidance for your profile. That's
              fine under medical supervision, but consider checking in with a doctor or dietitian if you're going
              this low on your own.
            </Alert>
          )}
          {showsDiminishingReturnsNote && (
            <Alert severity="info">
              This is a larger surplus than typically needed for lean gains — most of the extra is likely to be
              stored as fat rather than built as muscle.
            </Alert>
          )}
        </>
      )}

      <Typography fontSize={11} color="text.secondary">
        These suggestions are estimates based on general guidelines for your stated goal, not medical advice —
        consider checking in with a doctor or registered dietitian before making significant changes to your diet.
      </Typography>
    </Stack>
  );
}
