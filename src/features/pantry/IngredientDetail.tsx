import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { useAppStore } from '../../store/useAppStore';
import { ItemMetadata } from '../../components/ItemMetadata';
import { useProfileNames } from '../profiles/useProfileNames';
import { deleteIngredient, fetchIngredient, updateIngredient, type IngredientInput } from './api';
import { IngredientForm } from './IngredientForm';
import { DeleteIngredientDialog } from './DeleteIngredientDialog';
import { CopyIngredientDialog } from './CopyIngredientDialog';

// Distinguishes "still loading" from "query resolved, nothing found" —
// fetchIngredient resolves to undefined in both cases, so useLiveQuery needs
// a distinct default value to tell them apart (Dexie's documented pattern
// for this: https://dexie.org/docs/dexie-react-hooks/useLiveQuery()).
const LOADING = Symbol('loading');

export function IngredientDetail({ groupId, backPath }: { groupId: string | null; backPath: string }) {
  const { ingredientId } = useParams<{ ingredientId: string }>();
  const navigate = useNavigate();
  const userId = useAppStore((state) => state.userId);
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  const result = useLiveQuery(
    () => (ingredientId ? fetchIngredient(ingredientId) : undefined),
    [ingredientId],
    LOADING,
  );
  const loading = result === LOADING;
  const ingredient = result === LOADING ? undefined : result;

  // Group-context metadata only (design-system.md's "who added it" pattern
  // has no reason to name the user to themselves in personal context) — see
  // docs/pending-deviations.md (Ticket 12). `!= null` (not `!== null`) so a
  // pre-migration Dexie row that's missing `updated_by` entirely (`undefined`,
  // not `null` — see useProfileNames) doesn't slip through.
  const profileIds =
    groupId && ingredient ? [ingredient.created_by, ingredient.updated_by].filter((id) => id != null) : [];
  const profileNames = useProfileNames(profileIds);
  const wasUpdated = ingredient?.updated_by != null;

  async function handleSubmit(input: IngredientInput) {
    if (!ingredientId || !userId) return;
    await updateIngredient(ingredientId, userId, input);
    // Back to the list on success — its live query picks up the change
    // automatically. On error, IngredientForm surfaces it and we stay put.
    navigate(backPath, { replace: true });
  }

  async function handleDelete() {
    if (!ingredientId) return;
    await deleteIngredient(ingredientId);
    navigate(backPath, { replace: true });
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!ingredient) {
    return (
      <Box sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
        <Alert severity="error">Ingredient not found.</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
      {groupId && (
        <ItemMetadata
          creatorName={profileNames[ingredient.created_by]}
          createdAt={ingredient.created_at}
          updaterName={ingredient.updated_by ? profileNames[ingredient.updated_by] : undefined}
          updatedAt={ingredient.updated_at}
          wasUpdated={wasUpdated}
        />
      )}

      <Paper sx={{ p: 3, borderRadius: '14px', boxShadow: tokens.sh2 }}>
        <IngredientForm
          initialValues={{
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            kcal: ingredient.kcal,
            photo_url: ingredient.photo_url,
          }}
          ingredientId={ingredient.id}
          submitLabel="Save changes"
          onSubmit={handleSubmit}
        />
      </Paper>

      <Button variant="outlined" size="large" onClick={() => setCopyOpen(true)}>
        Copy to…
      </Button>

      <Button color="error" variant="outlined" size="large" onClick={() => setDeleteOpen(true)}>
        Delete ingredient
      </Button>

      <DeleteIngredientDialog
        open={deleteOpen}
        ingredientId={ingredient.id}
        ingredientName={ingredient.name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      <CopyIngredientDialog
        open={copyOpen}
        ingredientId={ingredient.id}
        ingredientName={ingredient.name}
        groupId={groupId}
        onClose={() => setCopyOpen(false)}
        onCopied={() => {
          setCopyOpen(false);
          setJustCopied(true);
        }}
      />

      <Snackbar
        open={justCopied}
        autoHideDuration={3000}
        onClose={() => setJustCopied(false)}
        message="Ingredient copied"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Stack>
  );
}
