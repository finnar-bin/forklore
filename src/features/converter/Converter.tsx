import { useState, type MouseEvent } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { useColorScheme } from "@mui/material/styles";
import { shadows } from "../../theme/theme";
import {
  UNIT_CATEGORIES,
  convertUnit,
  unitsForCategory,
  type UnitCategory,
} from "./units";

// Pure client-side calculator — no group/user data, no Dexie/Supabase, no
// outbox entry. See docs/pending-deviations.md ("Converter tab") for why
// this is dimensional-only (no ingredient-density cup->grams conversion).
export function Converter() {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const tokens = resolvedMode === "dark" ? shadows.dark : shadows.light;

  const [category, setCategory] = useState<UnitCategory>("weight");
  const units = unitsForCategory(category);
  const [fromUnit, setFromUnit] = useState(units[0].value);
  const [toUnit, setToUnit] = useState(units[1].value);
  const [amount, setAmount] = useState("1");

  function handleCategoryChange(
    _event: MouseEvent<HTMLElement>,
    next: UnitCategory | null,
  ) {
    if (!next) return;
    const nextUnits = unitsForCategory(next);
    setCategory(next);
    setFromUnit(nextUnits[0].value);
    setToUnit(nextUnits[1].value);
  }

  function handleSwap() {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  }

  const parsedAmount = parseFloat(amount);
  const result = Number.isFinite(parsedAmount)
    ? convertUnit(parsedAmount, fromUnit, toUnit)
    : null;

  return (
    <Box
      sx={{
        p: 2,
        pb: "calc(72px + env(safe-area-inset-bottom, 0px))",
        maxWidth: 480,
        mx: "auto",
      }}
    >
      <ToggleButtonGroup
        value={category}
        exclusive
        onChange={handleCategoryChange}
        fullWidth
        sx={{ mb: 2 }}
      >
        {UNIT_CATEGORIES.map((option) => (
          <ToggleButton key={option.value} value={option.value}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Paper sx={{ p: 2, borderRadius: "14px", boxShadow: tokens.sh2 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="Amount"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              slotProps={{ htmlInput: { step: "any" } }}
              sx={{ flex: 1 }}
            />
            <TextField
              select
              label="From"
              value={fromUnit}
              onChange={(event) => setFromUnit(event.target.value)}
              sx={{ flex: 1 }}
            >
              {units.map((unit) => (
                <MenuItem key={unit.value} value={unit.value}>
                  {unit.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <IconButton aria-label="Swap units" onClick={handleSwap}>
              <SwapVertIcon />
            </IconButton>
          </Box>

          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              alignItems: "center",
            }}
          >
            <Typography
              sx={{
                fontSize: 24,
                fontWeight: 500,
                color: "primary.main",
                flex: 1,
                overflowWrap: "anywhere",
              }}
            >
              {result !== null ? result.toFixed(4).replace(/\.?0+$/, "") : "—"}
            </Typography>
            <TextField
              select
              label="To"
              value={toUnit}
              onChange={(event) => setToUnit(event.target.value)}
              sx={{ flex: 1 }}
            >
              {units.map((unit) => (
                <MenuItem key={unit.value} value={unit.value}>
                  {unit.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
      </Paper>

      <Typography
        sx={{
          fontSize: 12,
          color: "text.secondary",
          mt: 2,
        }}
      >
        Cup, tablespoon, teaspoon, and fluid ounce use US customary
        measurements.
      </Typography>
    </Box>
  );
}
