import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useAppStore } from '../../store/useAppStore';
import { createIngredient, type IngredientInput } from './api';
import { IngredientForm } from './IngredientForm';
import type { Ingredient } from '../../types/ingredient';

export function CreateIngredientDialog({
  open,
  groupId = null,
  // Community pantry (docs/pending-deviations.md, "Community pantry") reuses
  // this same dialog rather than duplicating it — the only difference is the
  // created row's group_id/is_community and the dialog copy.
  isCommunity = false,
  onClose,
  onCreated,
}: {
  open: boolean;
  groupId?: string | null;
  isCommunity?: boolean;
  onClose: () => void;
  onCreated: (ingredient: Ingredient) => void;
}) {
  const userId = useAppStore((state) => state.userId);
  // Generated up front (not by createIngredient) so a staged photo can be
  // uploaded under this same id before the row itself exists — see
  // IngredientForm.tsx/DeferredPhotoUpload.tsx.
  //
  // Regenerated on every open, not just once per mount — this component
  // itself stays mounted across dialog open/close cycles (PantryList
  // renders it unconditionally, only toggling `open`; MUI's Dialog
  // unmounts/remounts IngredientForm on close/reopen, but not this
  // wrapper), so a plain `useState(() => crypto.randomUUID())` would reuse
  // the same id for every "Add ingredient" attempt in one page visit.
  // Reusing it after a successful create fails the next create outright
  // (Dexie's primary key already exists) and, worse, a staged photo for
  // that failed attempt would already have overwritten the first
  // ingredient's photo (upload happens before the create call). Adjusted
  // directly during render (React's documented pattern for resetting
  // state when a value changes) rather than in an effect — same
  // convention as RecipeDetail.tsx's baseline reseed.
  const [pendingId, setPendingId] = useState(() => crypto.randomUUID());
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPendingId(crypto.randomUUID());
    }
  }

  async function handleSubmit(input: IngredientInput) {
    if (!userId) return;
    const created = await createIngredient(pendingId, userId, groupId, input, isCommunity);
    onCreated(created);
  }

  const label = isCommunity ? 'Add to community pantry' : 'Add ingredient';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{label}</DialogTitle>
      {/* Extra top padding — otherwise the first field's floating label
          clips against the dialog content's scroll edge once focused. */}
      <DialogContent sx={{ pt: '12px !important' }}>
        <IngredientForm ingredientId={pendingId} submitLabel={label} onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  );
}
