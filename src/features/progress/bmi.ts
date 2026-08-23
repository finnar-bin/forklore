export function calculateBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

// Standard WHO adult thresholds — same thresholds onboarding's goal-weight
// sanity-check would use, if it needed them (it doesn't; only Progress
// displays a BMI at all).
export function getBmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

export const BMI_CATEGORY_LABELS: Record<BmiCategory, string> = {
  underweight: 'Underweight',
  normal: 'Normal',
  overweight: 'Overweight',
  obese: 'Obese',
};
