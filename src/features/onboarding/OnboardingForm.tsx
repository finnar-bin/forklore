import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAppStore } from '../../store/useAppStore';
import { completeOnboarding, fetchProfileName, type OnboardingInput } from './api';

const GOAL_TYPES: Array<{ value: OnboardingInput['goalType']; label: string }> = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'gain', label: 'Gain weight' },
  { value: 'maintain', label: 'Maintain weight' },
];

export function OnboardingForm() {
  const userId = useAppStore((state) => state.userId);
  const setOnboardingComplete = useAppStore((state) => state.setOnboardingComplete);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [goalType, setGoalType] = useState<OnboardingInput['goalType'] | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Google SSO already has a real name via handle_new_user; email/password
    // signups get the email's local part — pre-fill either way so the user
    // only has to correct it, not type it from scratch.
    if (userId) fetchProfileName(userId).then(setName).catch(() => {});
  }, [userId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!goalType) return;
    setError(null);
    setSubmitting(true);
    try {
      await completeOnboarding({
        name,
        heightCm: Number(height),
        weightKg: Number(weight),
        goalWeightKg: Number(goalWeight),
        goalType,
      });
      setOnboardingComplete(true);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <Stack spacing={3} component="form" onSubmit={handleSubmit}>
      <Typography variant="h5" fontWeight={500}>
        Tell us about yourself
      </Typography>
      <Typography variant="body2" color="text.secondary">
        This sets your starting point so we can track progress toward your goal.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        fullWidth
      />
      <TextField
        label="Height (cm)"
        type="number"
        value={height}
        onChange={(e) => setHeight(e.target.value)}
        required
        fullWidth
        slotProps={{ htmlInput: { min: 50, max: 300, step: 0.1 } }}
      />
      <TextField
        label="Current weight (kg)"
        type="number"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        required
        fullWidth
        slotProps={{ htmlInput: { min: 20, max: 400, step: 0.1 } }}
      />
      <TextField
        label="Goal weight (kg)"
        type="number"
        value={goalWeight}
        onChange={(e) => setGoalWeight(e.target.value)}
        required
        fullWidth
        slotProps={{ htmlInput: { min: 20, max: 400, step: 0.1 } }}
      />
      <TextField
        label="Goal"
        select
        value={goalType}
        onChange={(e) => setGoalType(e.target.value as OnboardingInput['goalType'])}
        required
        fullWidth
      >
        {GOAL_TYPES.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      <Button type="submit" variant="contained" size="large" disabled={submitting}>
        {submitting ? 'Saving…' : 'Continue'}
      </Button>
    </Stack>
  );
}
