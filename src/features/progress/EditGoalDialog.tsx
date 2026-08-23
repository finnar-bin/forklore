import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { SelectableCard } from '../../components/SelectableCard';
import { isGoalWeightValid } from '../onboarding/calorieCalc';
import { GOAL_TYPES } from '../onboarding/onboardingOptions';
import { updateGoal } from './api';
import type { GoalType, Profile } from '../../types/profile';

// Same goal-type cards + conditional goal-weight field as onboarding's
// GoalStep (SelectableCard, isGoalWeightValid) — no reason for this to look
// or validate differently just because it's an edit rather than first-time
// setup.
export function EditGoalDialog({
  open,
  userId,
  profile,
  currentWeight,
  onClose,
  onSaved,
}: {
  open: boolean;
  userId: string;
  profile: Profile;
  // For the same "goal weight must be below/above current weight" check
  // GoalStep already enforces — null skips that check (no weight logged
  // yet), which shouldn't happen once onboarding requires an initial entry,
  // but this screen doesn't assume it.
  currentWeight: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit goal</DialogTitle>
      {/* Mounted only while open, same reasoning as LogWeightDialog — form
          state starts fresh (from the current profile) each time. */}
      {open && (
        <EditGoalForm userId={userId} profile={profile} currentWeight={currentWeight} onSaved={onSaved} />
      )}
    </Dialog>
  );
}

function EditGoalForm({
  userId,
  profile,
  currentWeight,
  onSaved,
}: {
  userId: string;
  profile: Profile;
  currentWeight: number | null;
  onSaved: () => void;
}) {
  const [goalType, setGoalType] = useState<GoalType>(profile.goal_type ?? 'maintain');
  const [goalWeight, setGoalWeight] = useState(
    profile.goal_weight_kg !== null ? String(profile.goal_weight_kg) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsGoalWeight = goalType === 'lose' || goalType === 'gain';
  const goalWeightEntered = goalWeight.trim() !== '';
  const goalWeightError =
    needsGoalWeight && goalWeightEntered && currentWeight !== null
      && !isGoalWeightValid(goalType, String(currentWeight), goalWeight)
      ? goalType === 'lose'
        ? 'Goal weight should be lower than your current weight'
        : 'Goal weight should be higher than your current weight'
      : null;

  const canSubmit = !submitting && (!needsGoalWeight || (goalWeightEntered && goalWeightError === null));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await updateGoal(userId, {
        goalType,
        goalWeightKg: needsGoalWeight ? Number(goalWeight) : null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <DialogContent sx={{ pt: '12px !important' }}>
      <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
        {error && <Alert severity="error">{error}</Alert>}

        <Stack spacing={1}>
          {GOAL_TYPES.map((option) => (
            <SelectableCard
              key={option.value}
              title={option.label}
              selected={goalType === option.value}
              onClick={() => setGoalType(option.value)}
            />
          ))}
        </Stack>

        {needsGoalWeight && (
          <TextField
            label="Goal weight (kg)"
            type="number"
            value={goalWeight}
            onChange={(e) => setGoalWeight(e.target.value)}
            required
            fullWidth
            autoFocus
            error={goalWeightError !== null}
            helperText={goalWeightError}
            slotProps={{ htmlInput: { min: 20, max: 400, step: 0.1 } }}
          />
        )}

        <Button type="submit" variant="contained" size="large" disabled={!canSubmit}>
          {submitting ? 'Saving…' : 'Save goal'}
        </Button>
      </Stack>
    </DialogContent>
  );
}
