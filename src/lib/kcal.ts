// The amount-independent rate every ingredient/recipe card, detail page, and
// logging step shows next to a raw kcal total — "how many kcal per unit
// (ingredient) or per gram (recipe)". `quantity` is whatever the item's own
// base amount is (an ingredient's stock quantity, a recipe's weight_g); 0 —
// a still-being-typed form field, or an item with no defined amount yet —
// resolves to 0 rather than Infinity/NaN.
export function kcalPerUnit(kcal: number, quantity: number): number {
  return quantity > 0 ? kcal / quantity : 0;
}

const kcalFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

// Display format for every rendered kcal value: thousands separators, up to
// two decimals, trailing zeros dropped ("3,600", "105.5", "0.61"). Not for a
// form TextField's own live-typed value.
export function formatKcal(kcal: number): string {
  return kcalFormat.format(kcal);
}

// The display version of kcalPerUnit (e.g. "1.85"). Callers that also need
// the raw rate for further math (scaling by a quantity eaten, comparing
// against another item's rate) should call kcalPerUnit above instead.
export function formatKcalPerUnit(kcal: number, quantity: number): string {
  return formatKcal(kcalPerUnit(kcal, quantity));
}
