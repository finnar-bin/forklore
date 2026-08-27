import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { SelectableCard } from "../../../components/SelectableCard";
import { isGoalWeightValid } from "../calorieCalc";
import { GOAL_TYPES } from "../onboardingOptions";
import type { GoalType } from "../../../types/profile";

export function GoalStep({
  goalType,
  onGoalTypeChange,
  goalWeight,
  onGoalWeightChange,
  currentWeight,
}: {
  goalType: GoalType | "";
  onGoalTypeChange: (value: GoalType) => void;
  goalWeight: string;
  onGoalWeightChange: (value: string) => void;
  currentWeight: string;
}) {
  const needsGoalWeight = goalType === "lose" || goalType === "gain";
  const goalWeightEntered = goalWeight.trim() !== "";
  const goalWeightError =
    needsGoalWeight &&
    goalWeightEntered &&
    !isGoalWeightValid(goalType, currentWeight, goalWeight)
      ? goalType === "lose"
        ? "Goal weight should be lower than your current weight"
        : "Goal weight should be higher than your current weight"
      : null;

  return (
    <Stack spacing={2.5} sx={{ pt: 1 }}>
      <Stack spacing={1}>
        {GOAL_TYPES.map((option) => (
          <SelectableCard
            key={option.value}
            title={option.label}
            selected={goalType === option.value}
            onClick={() => onGoalTypeChange(option.value)}
          />
        ))}
      </Stack>

      {needsGoalWeight && (
        <TextField
          label="Goal weight (kg)"
          type="number"
          value={goalWeight}
          onChange={(e) => onGoalWeightChange(e.target.value)}
          required
          fullWidth
          error={goalWeightError !== null}
          helperText={goalWeightError}
          slotProps={{ htmlInput: { min: 20, max: 400, step: 0.1 } }}
        />
      )}
    </Stack>
  );
}
