// Cooking unit conversion — dimensional only (weight<->weight,
// volume<->volume, length<->length via fixed physical ratios). No
// ingredient-density-aware cross-category conversion (e.g. "1 cup flour to
// grams") — that would need a per-ingredient density that doesn't exist in
// the schema, and would cut against schema.md's documented invariant that
// ingredient/recipe/log quantities are never cross-unit-converted. This
// module is a standalone calculator with no relation to that data at all.
//
// Volume units (tsp/tbsp/cup/fl oz) are US customary, not metric-cup/UK —
// the convention most cooking recipes in this app's audience already use.
export type UnitCategory = "weight" | "volume" | "length";

export interface UnitDef {
  value: string;
  label: string;
  category: UnitCategory;
  // Multiply an amount in this unit by `toBase` to get the category's base
  // unit (gram for weight, milliliter for volume, centimeter for length).
  toBase: number;
}

export const CONVERTER_UNITS: UnitDef[] = [
  // Weight — base: gram
  { value: "g", label: "Grams (g)", category: "weight", toBase: 1 },
  { value: "kg", label: "Kilograms (kg)", category: "weight", toBase: 1000 },
  { value: "oz", label: "Ounces (oz)", category: "weight", toBase: 28.3495 },
  { value: "lb", label: "Pounds (lb)", category: "weight", toBase: 453.592 },

  // Volume — base: milliliter (US customary tsp/tbsp/cup/fl oz)
  { value: "ml", label: "Milliliters (ml)", category: "volume", toBase: 1 },
  { value: "l", label: "Liters (l)", category: "volume", toBase: 1000 },
  {
    value: "tsp",
    label: "Teaspoons (tsp)",
    category: "volume",
    toBase: 4.92892,
  },
  {
    value: "tbsp",
    label: "Tablespoons (tbsp)",
    category: "volume",
    toBase: 14.7868,
  },
  { value: "cup", label: "Cups (cup)", category: "volume", toBase: 236.588 },
  {
    value: "fl_oz",
    label: "Fluid ounces (fl oz)",
    category: "volume",
    toBase: 29.5735,
  },

  // Length — base: centimeter
  { value: "mm", label: "Millimeters (mm)", category: "length", toBase: 0.1 },
  { value: "cm", label: "Centimeters (cm)", category: "length", toBase: 1 },
  { value: "m", label: "Meters (m)", category: "length", toBase: 100 },
  { value: "in", label: "Inches (in)", category: "length", toBase: 2.54 },
  { value: "ft", label: "Feet (ft)", category: "length", toBase: 30.48 },
];

export const UNIT_CATEGORIES: Array<{ value: UnitCategory; label: string }> = [
  { value: "weight", label: "Weight" },
  { value: "volume", label: "Volume" },
  { value: "length", label: "Length" },
];

export function unitsForCategory(category: UnitCategory): UnitDef[] {
  return CONVERTER_UNITS.filter((unit) => unit.category === category);
}

// Callers only ever pass unit values drawn from the same category's own
// dropdown (see unitsForCategory), so a lookup miss can't happen in
// practice; still resolves to 0 rather than NaN as a defensive fallback,
// consistent with kcalPerUnit's div-by-zero convention (src/lib/kcal.ts).
export function convertUnit(
  amount: number,
  fromUnit: string,
  toUnit: string,
): number {
  const from = CONVERTER_UNITS.find((unit) => unit.value === fromUnit);
  const to = CONVERTER_UNITS.find((unit) => unit.value === toUnit);
  if (!from || !to) return 0;
  return (amount * from.toBase) / to.toBase;
}
