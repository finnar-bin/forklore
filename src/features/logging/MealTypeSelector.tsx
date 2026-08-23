import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { MEAL_TYPES, MEAL_TYPE_LABELS, type MealType } from '../../types/meal';

// Optional, so exclusive selection is allowed to end up empty — MUI's
// ToggleButtonGroup already reports `null` when the selected button is
// clicked again, which reads naturally as "unset".
export function MealTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: MealType | null;
  onChange: (value: MealType | null) => void;
  disabled?: boolean;
}) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_, next) => onChange(next)}
      size="small"
      fullWidth
      disabled={disabled}
    >
      {MEAL_TYPES.map((meal) => (
        <ToggleButton key={meal} value={meal}>
          {MEAL_TYPE_LABELS[meal]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
