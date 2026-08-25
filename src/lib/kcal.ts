// The amount-independent rate every ingredient/recipe card, detail page, and
// logging step shows next to a raw kcal total — "how many kcal per unit
// (ingredient) or per gram (recipe)". `quantity` is whatever the item's own
// base amount is (an ingredient's stock quantity, a recipe's weight_g); 0 —
// a still-being-typed form field, or an item with no defined amount yet —
// resolves to 0 rather than Infinity/NaN.
export function kcalPerUnit(kcal: number, quantity: number): number {
  return quantity > 0 ? kcal / quantity : 0;
}

// Every current call site renders this rate to two decimal places (e.g.
// "1.85 kcal/g") — this is the version most render call sites should use
// directly. Callers that also need the raw rate for further math (scaling
// by a quantity eaten, comparing against another item's rate) should call
// kcalPerUnit above instead.
export function formatKcalPerUnit(kcal: number, quantity: number): string {
  return kcalPerUnit(kcal, quantity).toFixed(2);
}
