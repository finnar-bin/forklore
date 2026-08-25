import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { DeferredPhotoUpload } from '../../components/DeferredPhotoUpload';
import { ItemMetadata } from '../../components/ItemMetadata';
import { deletePhoto, uploadPhoto } from '../../lib/photoUpload';
import { useAppStore } from '../../store/useAppStore';
import { PhotoThumbnail } from '../../components/PhotoThumbnail';
import { useProfileNames } from '../profiles/useProfileNames';
import { deleteIngredient, fetchIngredient, updateIngredient } from './api';
import { INGREDIENT_UNITS } from './ingredientUnits';
import { DeleteIngredientDialog } from './DeleteIngredientDialog';
import { CopyIngredientDialog } from './CopyIngredientDialog';
import type { Ingredient, IngredientUnit } from '../../types/ingredient';

// Distinguishes "still loading" from "query resolved, nothing found" — see
// the same pattern in RecipeDetail.tsx.
const LOADING = Symbol('loading');

// Mirrors RecipeDetail.tsx's shape: fields are staged client-side in
// name/quantity/unit/kcal/photoUrl and only written on Save, rather than
// reusing IngredientForm (which stays create-only, same as RecipeForm.tsx
// vs RecipeDetail.tsx) — this is what gives the two detail pages the same
// overall layout (photo + actions menu row, metadata, stat tiles, fields
// card, explicit Save button) instead of one page embedding a whole
// separate form component's own submit button.
// `savedIngredient` holds the last persisted snapshot, used both to diff
// what actually changed at save time and to know whether there's anything
// to save at all.
export function IngredientDetail({ groupId, backPath }: { groupId: string | null; backPath: string }) {
  const { ingredientId } = useParams<{ ingredientId: string }>();
  const navigate = useNavigate();
  const userId = useAppStore((state) => state.userId);
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const result = useLiveQuery(
    () => (ingredientId ? fetchIngredient(ingredientId) : undefined),
    [ingredientId],
    LOADING,
  );
  const loading = result === LOADING;
  const ingredient = result === LOADING ? undefined : result;

  const [savedIngredient, setSavedIngredient] = useState<Ingredient | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [unit, setUnit] = useState<IngredientUnit | ''>('');
  const [kcal, setKcal] = useState('0');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

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

  function applyIngredientBaseline(next: Ingredient) {
    setSavedIngredient(next);
    setName(next.name);
    setQuantity(next.quantity.toString());
    setUnit(next.unit);
    setKcal(next.kcal.toString());
    setPhotoUrl(next.photo_url);
  }

  // Seeds the draft from Dexie once per ingredient, not on every live-query
  // update — a background pull landing mid-edit must not clobber unsaved
  // changes. Adjusted directly during render (React's documented pattern for
  // resetting state when an id changes) rather than in an effect, since
  // `ingredient` is already available synchronously — see the same pattern
  // in RecipeDetail.tsx.
  if (ingredient && savedIngredient?.id !== ingredient.id) {
    applyIngredientBaseline(ingredient);
  }

  const parsedQuantity = Number(quantity);
  const parsedKcal = Number(kcal);
  const kcalPerUnit = parsedQuantity > 0 ? parsedKcal / parsedQuantity : 0;

  const isDirty = useMemo(() => {
    if (!savedIngredient) return false;
    if (name !== savedIngredient.name) return true;
    if (parsedQuantity !== savedIngredient.quantity) return true;
    if (unit !== savedIngredient.unit) return true;
    if (parsedKcal !== savedIngredient.kcal) return true;
    if (photoUrl !== savedIngredient.photo_url) return true;
    // A newly staged (not yet uploaded) photo doesn't change `photoUrl`
    // itself — the upload only happens at save time — so it needs its own
    // dirty check to enable the Save button.
    if (pendingPhotoFile) return true;
    return false;
  }, [name, parsedQuantity, unit, parsedKcal, photoUrl, pendingPhotoFile, savedIngredient]);

  const isValid =
    name.trim() !== '' &&
    unit !== '' &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0 &&
    Number.isFinite(parsedKcal) &&
    parsedKcal >= 0;

  async function handleSave() {
    if (!ingredientId || !userId || !savedIngredient || !unit) return;
    setSaving(true);
    setSaveError(null);
    try {
      const effectivePhotoUrl = pendingPhotoFile
        ? await uploadPhoto(pendingPhotoFile, 'ingredient', ingredientId)
        : photoUrl;
      const updated = await updateIngredient(ingredientId, userId, {
        name,
        quantity: parsedQuantity,
        unit,
        kcal: parsedKcal,
        photo_url: effectivePhotoUrl,
      });
      applyIngredientBaseline(updated);

      // Removing an existing photo (not just replacing it) also deletes its
      // R2 object, not just the field. Runs after the field update above
      // succeeds, not before — see the same ordering/best-effort reasoning
      // in RecipeDetail.tsx's handleSave.
      if (savedIngredient.photo_url && !effectivePhotoUrl) {
        try {
          await deletePhoto('ingredient', ingredientId);
        } catch {
          // Swallowed — see above.
        }
      }
      setPendingPhotoFile(null);
      setJustSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes. Try again.');
    } finally {
      setSaving(false);
    }
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

  if (!ingredient || !savedIngredient) {
    return (
      <Box sx={{ p: 2, maxWidth: 480, mx: 'auto' }}>
        <Alert severity="error">Ingredient not found.</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 480, mx: 'auto', pb: 4 }}>
      <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {canEdit ? (
          <DeferredPhotoUpload
            photoUrl={photoUrl}
            onChange={setPhotoUrl}
            onFileSelected={setPendingPhotoFile}
            alt={name || ingredient.name}
            size={200}
          />
        ) : (
          <PhotoThumbnail photoUrl={ingredient.photo_url} alt={ingredient.name} size={200} />
        )}
        <IconButton
          aria-label="Ingredient actions"
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{ position: 'absolute', top: 0, right: 0 }}
        >
          <MoreVertIcon />
        </IconButton>
      </Box>

      {(groupId || isCommunity) && (
        <ItemMetadata
          creatorName={profileNames[ingredient.created_by]}
          createdAt={ingredient.created_at}
          updaterName={ingredient.updated_by ? profileNames[ingredient.updated_by] : undefined}
          updatedAt={ingredient.updated_at}
          wasUpdated={wasUpdated}
        />
      )}

      {/* Stat tiles matching RecipeDetail.tsx's total/per-gram kcal
          pattern — kcal and kcal per unit, computed live from the draft
          fields (see kcalPerUnit above) rather than the last-saved row, so
          it updates as the user edits, before anything is saved. */}
      <Stack direction="row" spacing={1.5}>
        <Paper sx={{ flex: 1, p: 1.5, textAlign: 'center', borderRadius: '12px', boxShadow: tokens.sh1 }}>
          <Typography fontSize={18} fontWeight={500} color="primary.main">
            {parsedKcal}
          </Typography>
          <Typography fontSize={11} color="text.secondary">
            kcal
          </Typography>
        </Paper>
        <Paper sx={{ flex: 1, p: 1.5, textAlign: 'center', borderRadius: '12px', boxShadow: tokens.sh1 }}>
          <Typography fontSize={18} fontWeight={500} color="primary.main">
            {kcalPerUnit.toFixed(2)}
          </Typography>
          <Typography fontSize={11} color="text.secondary">
            kcal per {unit || ingredient.unit}
          </Typography>
        </Paper>
      </Stack>

      {canEdit ? (
        <Paper sx={{ p: 3, borderRadius: '14px', boxShadow: tokens.sh2 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={saving}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                fullWidth
                disabled={saving}
                slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              />
              <TextField
                label="Unit"
                select
                value={unit}
                onChange={(e) => setUnit(e.target.value as IngredientUnit)}
                required
                fullWidth
                disabled={saving}
              >
                {INGREDIENT_UNITS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField
              label="Kcal"
              type="number"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              required
              fullWidth
              disabled={saving}
              slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
            />
          </Stack>
        </Paper>
      ) : (
        // Read-only — only the creator may edit/delete a community
        // ingredient (docs/pending-deviations.md, "Community pantry").
        <Paper sx={{ p: 3, borderRadius: '14px', boxShadow: tokens.sh2 }}>
          <Stack spacing={1} alignItems="center">
            <Typography fontSize={18} fontWeight={500}>
              {ingredient.name}
            </Typography>
            <Typography color="text.secondary">
              {ingredient.quantity} {ingredient.unit} · {ingredient.kcal} kcal
            </Typography>
          </Stack>
        </Paper>
      )}

      <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
        {/* "Copy" stays available regardless of canEdit — forking a
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

      {saveError && <Alert severity="error">{saveError}</Alert>}

      {canEdit && (
        <Button variant="contained" size="large" onClick={handleSave} disabled={!isValid || !isDirty || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      )}

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
        open={justSaved}
        autoHideDuration={3000}
        onClose={() => setJustSaved(false)}
        message="Ingredient saved"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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
