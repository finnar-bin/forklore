import { useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useAppStore } from '../../store/useAppStore';
import { formatKcalPerUnit, kcalPerUnit } from '../../lib/kcal';
import { copyRecipe, findIngredientMatch, type IngredientMatch, type IngredientResolution } from '../copy/api';
import { CopyTargetList } from '../copy/CopyTargetList';
import { useCopyTargets } from '../copy/useCopyTargets';
import { fetchRecipeIngredients } from './api';
import type { RecipeIngredientDetail } from '../../types/recipe';

interface Conflict {
  source: RecipeIngredientDetail;
  match: IngredientMatch;
}

// Not a single flat step — target selection, then a silent per-ingredient
// match check, then (only for genuine name+unit matches) one confirmation
// per conflict, then the actual copy_recipe call. Nothing is written
// server-side until the very last step, so cancelling or hitting an error at
// any point earlier leaves no partial state to clean up. See
// docs/pending-deviations.md (Ticket 14).
type Phase = 'target' | 'checking' | 'conflict' | 'copying';

export function CopyRecipeDialog({
  open,
  recipeId,
  recipeName,
  groupId,
  onClose,
  onCopied,
}: {
  open: boolean;
  recipeId: string;
  recipeName: string;
  groupId: string | null;
  onClose: () => void;
  onCopied: () => void;
}) {
  const userId = useAppStore((state) => state.userId);
  const targets = useCopyTargets(open ? userId : null, groupId);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('target');
  const [error, setError] = useState<string | null>(null);

  // Resolutions accumulate as: every non-matching ingredient up front (null
  // — a fresh copy), then one more entry per conflict as the user answers it.
  const [resolutions, setResolutions] = useState<IngredientResolution[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [conflictIndex, setConflictIndex] = useState(0);

  // A ref, not state — a rapid double-tap/ghost-click on a conflict's
  // buttons can fire both events before React commits the state update from
  // the first, so a `useState` guard checked at the top of
  // handleConflictAnswer wouldn't reliably block the second call in time
  // (the visible `disabled` prop below is a secondary, render-timed defense
  // on top of this one). Without this, two near-simultaneous answers on the
  // *last* conflict could both reach finishCopy and fire copy_recipe twice,
  // creating a duplicate copy. See docs/pending-deviations.md (Ticket 14).
  const answeringRef = useRef(false);
  const [answering, setAnswering] = useState(false);

  function reset() {
    setSelectedIndex(null);
    setPhase('target');
    setError(null);
    setResolutions([]);
    setConflicts([]);
    setConflictIndex(0);
    answeringRef.current = false;
    setAnswering(false);
  }

  function handleClose() {
    if (phase === 'checking' || phase === 'copying') return;
    reset();
    onClose();
  }

  async function finishCopy(targetGroupId: string | null, allResolutions: IngredientResolution[]) {
    if (!userId) return;
    setPhase('copying');
    setError(null);
    try {
      const newRecipeId = await copyRecipe(userId, recipeId, targetGroupId, allResolutions);
      void newRecipeId;
      reset();
      onCopied();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy this recipe. Try again.');
      // Nothing was written server-side (copy_recipe is one transaction), so
      // it's safe to send the user all the way back to target selection
      // rather than inventing a way to resume mid-conflict. Release the
      // double-submit guard explicitly here — reset() (which also releases
      // it) only runs on the success path above.
      setPhase('target');
      answeringRef.current = false;
      setAnswering(false);
    }
  }

  async function handleContinue() {
    if (!userId || selectedIndex === null || !targets) return;
    const target = targets[selectedIndex];
    setError(null);
    setPhase('checking');
    try {
      const sourceIngredients = await fetchRecipeIngredients(recipeId);
      const checked = await Promise.all(
        sourceIngredients.map(async (source) => ({
          source,
          match: await findIngredientMatch(source.name, source.unit, target.groupId),
        })),
      );

      const autoResolutions: IngredientResolution[] = [];
      const foundConflicts: Conflict[] = [];
      for (const { source, match } of checked) {
        if (match) {
          foundConflicts.push({ source, match });
        } else {
          autoResolutions.push({ source_ingredient_id: source.ingredient_id, use_existing_id: null });
        }
      }

      setResolutions(autoResolutions);
      setConflicts(foundConflicts);
      setConflictIndex(0);

      if (foundConflicts.length === 0) {
        await finishCopy(target.groupId, autoResolutions);
      } else {
        setPhase('conflict');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check for matching ingredients. Try again.");
      setPhase('target');
    }
  }

  async function handleConflictAnswer(useExisting: boolean) {
    if (selectedIndex === null || !targets || answeringRef.current) return;
    answeringRef.current = true;
    setAnswering(true);

    const current = conflicts[conflictIndex];
    const nextResolutions = [
      ...resolutions,
      {
        source_ingredient_id: current.source.ingredient_id,
        use_existing_id: useExisting ? current.match.id : null,
      },
    ];

    if (conflictIndex + 1 < conflicts.length) {
      setResolutions(nextResolutions);
      setConflictIndex(conflictIndex + 1);
      answeringRef.current = false;
      setAnswering(false);
      return;
    }

    const target = targets[selectedIndex];
    // finishCopy never throws (it catches its own errors) and clears the
    // guard itself on both its success (via reset()) and failure paths, so
    // it's deliberately not cleared again here.
    await finishCopy(target.groupId, nextResolutions);
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      {phase === 'conflict' ? (
        <ConflictStep
          conflict={conflicts[conflictIndex]}
          index={conflictIndex}
          total={conflicts.length}
          disabled={answering}
          onUseExisting={() => handleConflictAnswer(true)}
          onAddAsNew={() => handleConflictAnswer(false)}
        />
      ) : (
        <>
          <DialogTitle>Copy {recipeName} to…</DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {phase === 'checking' || phase === 'copying' ? (
              <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
                <CircularProgress size={24} />
                <Typography fontSize={13} color="text.secondary">
                  {phase === 'checking' ? 'Checking ingredients…' : 'Copying recipe…'}
                </Typography>
              </Stack>
            ) : (
              <CopyTargetList targets={targets} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={phase === 'checking' || phase === 'copying'}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleContinue}
              disabled={selectedIndex === null || phase === 'checking' || phase === 'copying'}
            >
              Continue
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

// One conflict at a time — "use existing" links the new recipe to the
// already-present ingredient (source values discarded); "add as new" copies
// the source ingredient in fresh, so both coexist. No "overwrite existing"
// option (rpcs.md's confirmation UI contract — silently changing an
// ingredient's kcal would retroactively affect every other recipe already
// using it).
function ConflictStep({
  conflict,
  index,
  total,
  disabled,
  onUseExisting,
  onAddAsNew,
}: {
  conflict: Conflict;
  index: number;
  total: number;
  disabled: boolean;
  onUseExisting: () => void;
  onAddAsNew: () => void;
}) {
  const { source, match } = conflict;
  const sourceKcalPerUnit = kcalPerUnit(source.kcal, source.quantity);
  const kcalDiffers = Math.abs(sourceKcalPerUnit - match.kcal_per_unit) >= 0.01;

  return (
    <>
      <DialogTitle>
        Matching ingredient found ({index + 1} of {total})
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          "{match.name}" already exists in the target context with the same name and unit.
        </DialogContentText>
        <Stack direction="row" spacing={1.5}>
          <Box sx={{ flex: 1 }}>
            <Typography fontSize={11} color="text.secondary">
              This recipe's copy
            </Typography>
            <Typography fontSize={14} fontWeight={500}>
              {formatKcalPerUnit(source.kcal, source.quantity)} kcal/{source.unit}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography fontSize={11} color="text.secondary">
              Existing ingredient
            </Typography>
            <Typography fontSize={14} fontWeight={500} color={kcalDiffers ? 'error.main' : undefined}>
              {match.kcal_per_unit.toFixed(2)} kcal/{match.unit}
            </Typography>
          </Box>
        </Stack>
        {kcalDiffers && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            These values differ. Using the existing ingredient keeps its own values; adding as new
            keeps this recipe's own values as a separate ingredient.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onAddAsNew} disabled={disabled}>
          Add as new
        </Button>
        <Button variant="contained" onClick={onUseExisting} disabled={disabled}>
          Use existing
        </Button>
      </DialogActions>
    </>
  );
}
