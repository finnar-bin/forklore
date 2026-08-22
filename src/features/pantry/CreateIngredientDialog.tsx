import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useAppStore } from '../../store/useAppStore';
import { createIngredient, type IngredientInput } from './api';
import { IngredientForm } from './IngredientForm';
import type { Ingredient } from '../../types/ingredient';

export function CreateIngredientDialog({
  open,
  groupId,
  onClose,
  onCreated,
}: {
  open: boolean;
  groupId: string | null;
  onClose: () => void;
  onCreated: (ingredient: Ingredient) => void;
}) {
  const userId = useAppStore((state) => state.userId);

  async function handleSubmit(input: IngredientInput) {
    if (!userId) return;
    const created = await createIngredient(userId, groupId, input);
    onCreated(created);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add ingredient</DialogTitle>
      {/* Extra top padding — otherwise the first field's floating label
          clips against the dialog content's scroll edge once focused. */}
      <DialogContent sx={{ pt: '12px !important' }}>
        <IngredientForm submitLabel="Add ingredient" onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  );
}
