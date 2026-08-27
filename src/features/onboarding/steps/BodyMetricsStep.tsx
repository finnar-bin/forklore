import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

export function BodyMetricsStep({
  height,
  onHeightChange,
  weight,
  onWeightChange,
}: {
  height: string;
  onHeightChange: (value: string) => void;
  weight: string;
  onWeightChange: (value: string) => void;
}) {
  return (
    <Stack spacing={2.5} sx={{ pt: 1 }}>
      <TextField
        label="Height (cm)"
        type="number"
        value={height}
        onChange={(e) => onHeightChange(e.target.value)}
        required
        fullWidth
        slotProps={{ htmlInput: { min: 50, max: 300, step: 0.1 } }}
      />
      <TextField
        label="Current weight (kg)"
        type="number"
        value={weight}
        onChange={(e) => onWeightChange(e.target.value)}
        required
        fullWidth
        slotProps={{ htmlInput: { min: 20, max: 400, step: 0.1 } }}
      />
    </Stack>
  );
}
