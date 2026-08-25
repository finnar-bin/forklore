import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { useAppStore } from '../../store/useAppStore';
import { ItemMetadata } from '../../components/ItemMetadata';
import { PhotoThumbnail } from '../../components/PhotoThumbnail';
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
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const result = useLiveQuery(
    () => (ingredientId ? fetchIngredient(ingredientId) : undefined),
    [ingredientId],
    LOADING,
  );
  const loading = result === LOADING;
  const ingredient = result === LOADING ? undefined : result;

  // Derived from the loaded row itself, not the route's groupId prop — a
  // community ingredient can be reached from /pantry, any
  // /groups/:id/pantry, or /community-pantry alike, and permission has
  // nothing to do with which of those it was opened from. Only the creator
  // may edit/delete a community ingredient (the RLS rule this mirrors on
  // the client — see docs/pending-deviations.md, "Community pantry");
  // everyone else gets a read-only view.
  const isCommunity = ingredient?.is_community ?? false;
  const canEdit = !isCommunity || ingredient?.created_by === userId;

  // Shown for group context (design-system.md's "who added it" pattern has
  // no reason to name the user to themselves in personal context — see
  // docs/pending-deviations.md, Ticket 12) or for any community ingredient
  // regardless of context, since its creator isn't necessarily "you" even
  // in your own personal pantry. `!= null` (not `!== null`) so a
  // pre-migration Dexie row that's missing `updated_by` entirely (`undefined`,
  // not `null` — see useProfileNames) doesn't slip through.
  const profileIds =
    (groupId || isCommunity) && ingredient
      ? [ingredient.created_by, ingredient.updated_by].filter((id) => id != null)
      : [];
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
      {(groupId || isCommunity) && (
        <ItemMetadata
          creatorName={profileNames[ingredient.created_by]}
          createdAt={ingredient.created_at}
          updaterName={ingredient.updated_by ? profileNames[ingredient.updated_by] : undefined}
          updatedAt={ingredient.updated_at}
          wasUpdated={wasUpdated}
        />
      )}

      <Box sx={{ position: 'relative' }}>
        <IconButton
          aria-label="Ingredient actions"
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
        >
          <MoreVertIcon />
        </IconButton>

        {canEdit ? (
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
        ) : (
          // Read-only — only the creator may edit/delete a community
          // ingredient (docs/pending-deviations.md, "Community pantry").
          <Paper sx={{ p: 3, borderRadius: '14px', boxShadow: tokens.sh2 }}>
            <Stack spacing={2} alignItems="center">
              <PhotoThumbnail photoUrl={ingredient.photo_url} alt={ingredient.name} size={120} />
              <Typography fontSize={18} fontWeight={500}>
                {ingredient.name}
              </Typography>
              <Typography color="text.secondary">
                {ingredient.quantity} {ingredient.unit} · {ingredient.kcal} kcal
              </Typography>
            </Stack>
          </Paper>
        )}
      </Box>

      <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
        {/* "Copy to…" stays available regardless of canEdit — forking a
            community ingredient into your own, independently-editable
            personal or group pantry row is allowed for everyone, not just
            its creator. See docs/pending-deviations.md ("Community
            pantry"). */}
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setCopyOpen(true);
          }}
        >
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" sx={{ color: 'text.primary' }} />
          </ListItemIcon>
          <ListItemText>Copy</ListItemText>
        </MenuItem>

        {canEdit && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setDeleteOpen(true);
            }}
          >
            <ListItemIcon>
              <DeleteOutlineIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <DeleteIngredientDialog
        open={deleteOpen}
        ingredientId={ingredient.id}
        ingredientName={ingredient.name}
        isCommunity={isCommunity}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />

      <CopyIngredientDialog
        open={copyOpen}
        ingredientId={ingredient.id}
        ingredientName={ingredient.name}
        groupId={groupId}
        isCommunity={isCommunity}
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
