import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import MobileStepper from "@mui/material/MobileStepper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useAppStore } from "../../store/useAppStore";
import { getStoredGroupId } from "../../lib/activeGroupStorage";
import { resolveDefaultGroupId } from "../../lib/defaultGroup";
import { useMyGroups } from "../groups/useMyGroups";
import { fetchMyProfile, updateMyProfile } from "../profiles/api";
import { deletePhoto } from "../../lib/photoUpload";
import { completeOnboarding } from "./api";
import {
  calculateAge,
  calculateBmr,
  calculateCalorieOptions,
  calculateTdee,
  emptyMealKcalTargets,
  getResolvedDailyKcal,
  isCustomKcalValid,
  isGoalWeightValid,
  isMealBreakdownValid,
  mealKcalTargetsToNumbers,
  resolveCalorieTarget,
} from "./calorieCalc";
import { AboutYouStep } from "./steps/AboutYouStep";
import { BodyMetricsStep } from "./steps/BodyMetricsStep";
import { ActivityLevelStep } from "./steps/ActivityLevelStep";
import { GoalStep } from "./steps/GoalStep";
import {
  CalorieTargetStep,
  type CalorieSelection,
} from "./steps/CalorieTargetStep";
import { CreateOrJoinGroupStep } from "./steps/CreateOrJoinGroupStep";
import type {
  ActivityLevel,
  BiologicalSex,
  GoalType,
} from "../../types/profile";
import type { MealType } from "../../types/meal";

// "Group" is mandatory — every account must belong to at least one group
// now (see docs/pending-deviations.md, "Remove personal mode").
const STEP_LABELS = [
  "About you",
  "Body metrics",
  "Activity level",
  "Goal",
  "Calorie target",
  "Group",
];
const GROUP_STEP_INDEX = STEP_LABELS.length - 1;

function isValidNumberInRange(
  value: string,
  min: number,
  max: number,
): boolean {
  const num = Number(value);
  return (
    value.trim() !== "" && Number.isFinite(num) && num >= min && num <= max
  );
}

export function OnboardingStepper() {
  const userId = useAppStore((state) => state.userId);
  const setOnboardingComplete = useAppStore(
    (state) => state.setOnboardingComplete,
  );
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  // Shared cache — createGroup/acceptGroupInvite (called from
  // CreateOrJoinGroupStep) invalidate it themselves, so this flips to true
  // reactively once either succeeds, with no callback plumbing needed.
  const groups = useMyGroups(userId);
  const hasGroup = (groups?.length ?? 0) > 0;

  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [sex, setSex] = useState<BiologicalSex | "">("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // The profile's avatar_url as originally fetched, kept separate from the
  // live-editable `avatarUrl` above so handleFinish can tell "the user
  // explicitly removed a pre-filled avatar" (originalAvatarUrl set,
  // avatarUrl null) apart from "never had one" or "unchanged" — only the
  // former needs both a field update AND an R2 cleanup call.
  const [originalAvatarUrl, setOriginalAvatarUrl] = useState<string | null>(
    null,
  );
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  const [activityLevel, setActivityLevel] = useState<ActivityLevel | "">("");

  const [goalType, setGoalType] = useState<GoalType | "">("");
  const [goalWeight, setGoalWeight] = useState("");

  const [calorieSelection, setCalorieSelection] = useState<
    CalorieSelection | ""
  >("");
  const [customKcal, setCustomKcal] = useState("");
  const [mealBreakdownEnabled, setMealBreakdownEnabled] = useState(false);
  const [mealKcalTargets, setMealKcalTargets] = useState<
    Record<MealType, string>
  >(emptyMealKcalTargets());

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Google SSO already has a real name/avatar via handle_new_user;
    // email/password signups get the email's local part and no avatar —
    // pre-fill either way so the user only has to correct it, not type/pick
    // it from scratch.
    if (!userId) return;
    fetchMyProfile(userId)
      .then((profile) => {
        setName(profile.name);
        setAvatarUrl(profile.avatar_url);
        setOriginalAvatarUrl(profile.avatar_url);
        // A returning user who already finished the profile steps in an
        // earlier session but bailed before the group step (this flow has
        // no other persistence — see the stepper's own local-state-only
        // design) lands straight on it instead of retyping everything from
        // "About you." See docs/pending-deviations.md ("Remove personal
        // mode").
        if (profile.daily_kcal_target != null) {
          setActiveStep(GROUP_STEP_INDEX);
        }
      })
      .catch(() => {});
  }, [userId]);

  const age = useMemo(
    () => (birthdate ? calculateAge(birthdate) : null),
    [birthdate],
  );

  const calorieOptions = useMemo(() => {
    if (
      age === null ||
      !sex ||
      !height ||
      !weight ||
      !activityLevel ||
      !goalType
    )
      return null;
    const bmr = calculateBmr({
      sex,
      weightKg: Number(weight),
      heightCm: Number(height),
      age,
    });
    const tdee = calculateTdee(bmr, activityLevel);
    return calculateCalorieOptions(tdee, goalType, sex);
  }, [age, sex, height, weight, activityLevel, goalType]);

  const stepValid = [
    name.trim() !== "" &&
      birthdate !== "" &&
      age !== null &&
      age >= 13 &&
      age <= 120 &&
      sex !== "",
    isValidNumberInRange(height, 50, 300) &&
      isValidNumberInRange(weight, 20, 400),
    activityLevel !== "",
    goalType !== "" &&
      (goalType === "maintain" ||
        (isValidNumberInRange(goalWeight, 20, 400) &&
          isGoalWeightValid(goalType, weight, goalWeight))),
    calorieSelection !== "" &&
      (calorieSelection !== "custom" ||
        (calorieOptions !== null &&
          isCustomKcalValid(
            Number(customKcal),
            calorieOptions.maintenanceKcal,
          ))) &&
      isMealBreakdownValid(
        mealBreakdownEnabled,
        mealKcalTargets,
        getResolvedDailyKcal(calorieSelection, customKcal, calorieOptions),
      ),
    hasGroup,
  ];

  function handleBack() {
    setActiveStep((step) => step - 1);
  }

  function handleNext() {
    setActiveStep((step) => step + 1);
  }

  function handleMealKcalTargetChange(meal: MealType, value: string) {
    setMealKcalTargets((prev) => ({ ...prev, [meal]: value }));
  }

  async function handleFinish() {
    if (
      !calorieOptions ||
      !sex ||
      !activityLevel ||
      !goalType ||
      calorieSelection === ""
    )
      return;

    const resolved = resolveCalorieTarget(
      calorieSelection,
      customKcal,
      calorieOptions,
    );
    if (!resolved) return;
    const { goalPace, dailyKcalTarget } = resolved;
    const mealTargets = mealBreakdownEnabled
      ? mealKcalTargetsToNumbers(mealKcalTargets)
      : null;

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
        goalWeightKg:
          goalType === "maintain" ? Number(weight) : Number(goalWeight),
        goalPace,
        dailyKcalTarget,
        mealBreakdownEnabled,
        breakfastKcalTarget: mealTargets?.breakfast ?? null,
        lunchKcalTarget: mealTargets?.lunch ?? null,
        dinnerKcalTarget: mealTargets?.dinner ?? null,
        snackKcalTarget: mealTargets?.snack ?? null,
      });

      // Only touches the avatar at all if it actually changed — skips a
      // wasted call when the user never touched the pre-filled value.
      if (avatarUrl !== originalAvatarUrl && userId) {
        try {
          await updateMyProfile(userId, { avatar_url: avatarUrl });
          // Explicitly removed a pre-filled avatar (not "added a new one,"
          // which overwrites the same deterministic R2 key with nothing
          // to clean up) — delete its R2 object, but only now that the
          // field update above has actually landed; deleting first and
          // then having that update fail would leave the row still
          // pointing at a now-deleted object.
          if (originalAvatarUrl && !avatarUrl) {
            await deletePhoto("avatar");
          }
        } catch {
          // Onboarding itself succeeded; a failed avatar save/cleanup
          // shouldn't block getting into the app — editable later from
          // /profile. See docs/pending-deviations.md (Ticket 15).
        }
      }

      setOnboardingComplete(true);
      // Same resolveDefaultGroupId convention HomeRedirect/BottomNav use —
      // nothing's been explicitly picked yet at this point (creating/joining
      // a group in CreateOrJoinGroupStep doesn't itself persist a pick), so
      // this almost always resolves to null and falls through to "/", which
      // HomeRedirect then sends to /groups to choose — requested directly,
      // rather than guessing which of the user's groups (there can be more
      // than one, e.g. if they also accepted an invite before finishing
      // onboarding) to drop them into.
      const groupId = resolveDefaultGroupId(groups, getStoredGroupId());
      navigate(groupId ? `/groups/${groupId}/pantry` : "/", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
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
        This sets your starting point so we can calculate your daily calorie
        target.
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Typography fontSize={13} color="text.secondary">
        Step {activeStep + 1} of {STEP_LABELS.length} ·{" "}
        {STEP_LABELS[activeStep]}
      </Typography>

      {activeStep === 0 && (
        <AboutYouStep
          name={name}
          onNameChange={setName}
          birthdate={birthdate}
          onBirthdateChange={setBirthdate}
          sex={sex}
          onSexChange={setSex}
          avatarUrl={avatarUrl}
          onAvatarUrlChange={setAvatarUrl}
          onAvatarUploadingChange={setAvatarUploading}
        />
      )}
      {activeStep === 1 && (
        <BodyMetricsStep
          height={height}
          onHeightChange={setHeight}
          weight={weight}
          onWeightChange={setWeight}
        />
      )}
      {activeStep === 2 && (
        <ActivityLevelStep
          activityLevel={activityLevel}
          onChange={setActivityLevel}
        />
      )}
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
          mealBreakdownEnabled={mealBreakdownEnabled}
          onMealBreakdownEnabledChange={setMealBreakdownEnabled}
          mealKcalTargets={mealKcalTargets}
          onMealKcalTargetChange={handleMealKcalTargetChange}
        />
      )}
      {activeStep === GROUP_STEP_INDEX && (
        <CreateOrJoinGroupStep hasGroup={hasGroup} />
      )}

      <MobileStepper
        variant="progress"
        steps={STEP_LABELS.length}
        position="static"
        activeStep={activeStep}
        sx={{
          bgcolor: "transparent",
          p: 0,
          "& .MuiLinearProgress-root": { flex: 1, mx: 1.5 },
        }}
        nextButton={
          isLastStep ? (
            <Button
              size="small"
              variant="contained"
              onClick={handleFinish}
              disabled={!stepValid[activeStep] || submitting || avatarUploading}
            >
              {submitting ? "Saving…" : "Get started"}
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              onClick={handleNext}
              disabled={
                !stepValid[activeStep] || (activeStep === 0 && avatarUploading)
              }
            >
              Continue
            </Button>
          )
        }
        backButton={
          <Button
            size="small"
            onClick={handleBack}
            disabled={activeStep === 0 || submitting}
          >
            Back
          </Button>
        }
      />
    </Stack>
  );
}
