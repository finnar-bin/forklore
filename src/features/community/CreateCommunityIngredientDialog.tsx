import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useAppStore } from '../../store/useAppStore';
import { createIngredient, type IngredientInput } from '../pantry/api';
import { IngredientForm } from '../pantry/IngredientForm';
import type { Ingredient } from '../../types/ingredient';

// Same shape as CreateIngredientDialog.tsx, except the created row is
// community-wide (group_id null, is_community true) rather than personal or
// group-scoped — see docs/pending-deviations.md ("Community pantry").
export function CreateCommunityIngredientDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (ingredient: Ingredient) => void;
}) {
  const userId = useAppStore((state) => state.userId);
  // Regenerated on every open — see CreateIngredientDialog.tsx's own comment
  // for why this can't be a plain useState(() => ...).
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
    const created = await createIngredient(pendingId, userId, null, input, true);
    onCreated(created);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add to community pantry</DialogTitle>
      <DialogContent sx={{ pt: '12px !important' }}>
        <IngredientForm
          ingredientId={pendingId}
          submitLabel="Add to community pantry"
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
