import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MobileStepper from '@mui/material/MobileStepper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAppStore } from '../../store/useAppStore';
import { completeOnboarding, fetchProfileName } from './api';
import {
  calculateAge,
  calculateBmr,
  calculateCalorieOptions,
  calculateTdee,
  isCustomKcalValid,
  isGoalWeightValid,
  resolveCalorieTarget,
} from './calorieCalc';
import { AboutYouStep } from './steps/AboutYouStep';
import { BodyMetricsStep } from './steps/BodyMetricsStep';
import { ActivityLevelStep } from './steps/ActivityLevelStep';
import { GoalStep } from './steps/GoalStep';
import { CalorieTargetStep, type CalorieSelection } from './steps/CalorieTargetStep';
import type { ActivityLevel, BiologicalSex, GoalType } from '../../types/profile';

const STEP_LABELS = ['About you', 'Body metrics', 'Activity level', 'Goal', 'Calorie target'];

function isValidNumberInRange(value: string, min: number, max: number): boolean {
  const num = Number(value);
  return value.trim() !== '' && Number.isFinite(num) && num >= min && num <= max;
}

export function OnboardingStepper() {
  const userId = useAppStore((state) => state.userId);
  const setOnboardingComplete = useAppStore((state) => state.setOnboardingComplete);
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);

  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [sex, setSex] = useState<BiologicalSex | ''>('');

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const [activityLevel, setActivityLevel] = useState<ActivityLevel | ''>('');

  const [goalType, setGoalType] = useState<GoalType | ''>('');
  const [goalWeight, setGoalWeight] = useState('');

  const [calorieSelection, setCalorieSelection] = useState<CalorieSelection | ''>('');
  const [customKcal, setCustomKcal] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Google SSO already has a real name via handle_new_user; email/password
    // signups get the email's local part — pre-fill either way so the user
    // only has to correct it, not type it from scratch.
    if (userId) fetchProfileName(userId).then(setName).catch(() => {});
  }, [userId]);

  const age = useMemo(() => (birthdate ? calculateAge(birthdate) : null), [birthdate]);

  const calorieOptions = useMemo(() => {
    if (age === null || !sex || !height || !weight || !activityLevel || !goalType) return null;
    const bmr = calculateBmr({ sex, weightKg: Number(weight), heightCm: Number(height), age });
    const tdee = calculateTdee(bmr, activityLevel);
    return calculateCalorieOptions(tdee, goalType, sex);
  }, [age, sex, height, weight, activityLevel, goalType]);

  const stepValid = [
    name.trim() !== '' && birthdate !== '' && age !== null && age >= 13 && age <= 120 && sex !== '',
    isValidNumberInRange(height, 50, 300) && isValidNumberInRange(weight, 20, 400),
    activityLevel !== '',
    goalType !== '' &&
      (goalType === 'maintain' ||
        (isValidNumberInRange(goalWeight, 20, 400) && isGoalWeightValid(goalType, weight, goalWeight))),
    calorieSelection !== '' &&
      (calorieSelection !== 'custom' ||
        (calorieOptions !== null && isCustomKcalValid(Number(customKcal), calorieOptions.maintenanceKcal))),
  ];

  function handleBack() {
    setActiveStep((step) => step - 1);
  }

  function handleNext() {
    setActiveStep((step) => step + 1);
  }

  async function handleFinish() {
    if (!calorieOptions || !sex || !activityLevel || !goalType || calorieSelection === '') return;

    const resolved = resolveCalorieTarget(calorieSelection, customKcal, calorieOptions);
    if (!resolved) return;
    const { goalPace, dailyKcalTarget } = resolved;

    setError(null);
    setSubmitting(true);
    try {
      await completeOnboarding({
        name,
        birthdate,
        sex,
        heightCm: Number(height),
        weightKg: Number(weight),
        activityLevel,
        goalType,
        goalWeightKg: goalType === 'maintain' ? Number(weight) : Number(goalWeight),
        goalPace,
        dailyKcalTarget,
      });
      setOnboardingComplete(true);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  const isLastStep = activeStep === STEP_LABELS.length - 1;

  return (
    <Stack spacing={3}>
      <Typography variant="h5" fontWeight={500}>
        Tell us about yourself
      </Typography>
      <Typography variant="body2" color="text.secondary">
        This sets your starting point so we can calculate your daily calorie target.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Typography fontSize={13} color="text.secondary">
        Step {activeStep + 1} of {STEP_LABELS.length} · {STEP_LABELS[activeStep]}
      </Typography>

      {activeStep === 0 && (
        <AboutYouStep
          name={name}
          onNameChange={setName}
          birthdate={birthdate}
          onBirthdateChange={setBirthdate}
          sex={sex}
          onSexChange={setSex}
        />
      )}
      {activeStep === 1 && (
        <BodyMetricsStep height={height} onHeightChange={setHeight} weight={weight} onWeightChange={setWeight} />
      )}
      {activeStep === 2 && <ActivityLevelStep activityLevel={activityLevel} onChange={setActivityLevel} />}
      {activeStep === 3 && (
        <GoalStep
          goalType={goalType}
          onGoalTypeChange={setGoalType}
          goalWeight={goalWeight}
          onGoalWeightChange={setGoalWeight}
          currentWeight={weight}
        />
      )}
      {activeStep === 4 && calorieOptions && goalType && sex && (
        <CalorieTargetStep
          goalType={goalType}
          sex={sex}
          calorieOptions={calorieOptions}
          selection={calorieSelection}
          onSelectionChange={setCalorieSelection}
          customKcal={customKcal}
          onCustomKcalChange={setCustomKcal}
        />
      )}

      <MobileStepper
        variant="progress"
        steps={STEP_LABELS.length}
        position="static"
        activeStep={activeStep}
        sx={{ bgcolor: 'transparent', p: 0, '& .MuiLinearProgress-root': { flex: 1, mx: 1.5 } }}
        nextButton={
          isLastStep ? (
            <Button
              size="small"
              variant="contained"
              onClick={handleFinish}
              disabled={!stepValid[activeStep] || submitting}
            >
              {submitting ? 'Saving…' : 'Get started'}
            </Button>
          ) : (
            <Button size="small" variant="contained" onClick={handleNext} disabled={!stepValid[activeStep]}>
              Continue
            </Button>
          )
        }
        backButton={
          <Button size="small" onClick={handleBack} disabled={activeStep === 0 || submitting}>
            Back
          </Button>
        }
      />
    </Stack>
  );
}
