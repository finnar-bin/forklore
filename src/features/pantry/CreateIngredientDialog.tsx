import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useAppStore } from '../../store/useAppStore';
import { createIngredient, type IngredientInput } from './api';
import { IngredientForm } from './IngredientForm';
import type { Ingredient } from '../../types/ingredient';

export function CreateIngredientDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (ingredient: Ingredient) => void;
}) {
  const userId = useAppStore((state) => state.userId);

  async function handleSubmit(input: IngredientInput) {
    if (!userId) return;
    const created = await createIngredient(userId, input);
    onCreated(created);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add ingredient</DialogTitle>
      <DialogContent>
        <IngredientForm submitLabel="Add ingredient" onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  );
}
