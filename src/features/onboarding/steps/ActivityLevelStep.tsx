import Stack from "@mui/material/Stack";
import { SelectableCard } from "../../../components/SelectableCard";
import { ACTIVITY_LEVELS } from "../onboardingOptions";
import type { ActivityLevel } from "../../../types/profile";

export function ActivityLevelStep({
  activityLevel,
  onChange,
}: {
  activityLevel: ActivityLevel | "";
  onChange: (value: ActivityLevel) => void;
}) {
  return (
    <Stack spacing={1} sx={{ pt: 1 }}>
      {ACTIVITY_LEVELS.map((option) => (
        <SelectableCard
          key={option.value}
          title={option.label}
          description={option.description}
          selected={activityLevel === option.value}
          onClick={() => onChange(option.value)}
        />
      ))}
    </Stack>
  );
}
