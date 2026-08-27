import type {
  ActivityLevel,
  BiologicalSex,
  GoalType,
} from "../../types/profile";

// Mirrors the `biological_sex` / `activity_level` / `goal_type` Postgres enums
// (schema.md) — single source of truth for these option lists so they can't
// drift from the closed enum sets, same pattern as INGREDIENT_UNITS.

export const BIOLOGICAL_SEXES: Array<{ value: BiologicalSex; label: string }> =
  [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
  ];

export const ACTIVITY_LEVELS: Array<{
  value: ActivityLevel;
  label: string;
  description: string;
}> = [
  {
    value: "sedentary",
    label: "Sedentary",
    description: "Little or no exercise",
  },
  {
    value: "light",
    label: "Lightly active",
    description: "Exercise 1-3 days a week",
  },
  {
    value: "moderate",
    label: "Moderately active",
    description: "Exercise 3-5 days a week",
  },
  {
    value: "very_active",
    label: "Very active",
    description: "Exercise 6-7 days a week",
  },
  {
    value: "extremely_active",
    label: "Extremely active",
    description: "Hard daily exercise or a physical job",
  },
];

export const GOAL_TYPES: Array<{ value: GoalType; label: string }> = [
  { value: "lose", label: "Lose weight" },
  { value: "gain", label: "Gain weight" },
  { value: "maintain", label: "Maintain weight" },
];
