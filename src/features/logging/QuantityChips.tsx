import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";

// Shortcut amounts under a quantity field — the last amount logged for this
// item first, then round numbers for the unit.
export function QuantityChips({
  unit,
  last,
  max,
  disabled,
  onPick,
}: {
  unit: string;
  last?: number;
  max?: number;
  disabled?: boolean;
  onPick: (value: number) => void;
}) {
  const presets = unit === "g" || unit === "ml" ? [50, 100, 200] : [1, 2];
  const values = [...(last ? [last] : []), ...presets].filter(
    (v, i, all) => all.indexOf(v) === i && (max === undefined || v <= max),
  );
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
      {values.map((v) => (
        <Chip
          key={v}
          size="small"
          clickable
          disabled={disabled}
          label={`${v === last ? "Last: " : ""}${v} ${unit}`}
          onClick={() => onPick(v)}
        />
      ))}
    </Stack>
  );
}
