import Stack from "@mui/material/Stack";
import { formatKcal } from "../../../lib/kcal";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { sumMealKcalTargets } from "../calorieCalc";
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  type MealType,
} from "../../../types/meal";

export function MealBreakdownFields({
  values,
  onChange,
  dailyTotal,
  disabled,
}: {
  values: Record<MealType, string>;
  onChange: (meal: MealType, value: string) => void;
  dailyTotal: number;
  disabled?: boolean;
}) {
  const allocated = sumMealKcalTargets(values);
  const remaining = dailyTotal - allocated;

  return (
    <Stack spacing={1.5}>
      {MEAL_TYPES.map((meal) => (
        <TextField
          key={meal}
          label={MEAL_TYPE_LABELS[meal]}
          type="number"
          value={values[meal]}
          onChange={(e) => onChange(meal, e.target.value)}
          fullWidth
          size="small"
          disabled={disabled}
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
        />
      ))}
      <Typography
        color={remaining === 0 ? "text.secondary" : "error.main"}
        sx={{
          fontSize: 12,
          textAlign: "right",
        }}
      >
        {remaining === 0
          ? `${formatKcal(allocated)} / ${formatKcal(dailyTotal)} kcal allocated`
          : remaining > 0
            ? `${formatKcal(remaining)} kcal left to allocate`
            : `${formatKcal(Math.abs(remaining))} kcal over your daily target`}
      </Typography>
    </Stack>
  );
}
