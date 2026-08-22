import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useAppStore } from '../../store/useAppStore';
import { createRecipe } from './api';
import { RecipeForm } from './RecipeForm';
import type { Recipe, RecipeInput } from '../../types/recipe';

export function CreateRecipeDialog({
  open,
  groupId,
  onClose,
  onCreated,
}: {
  open: boolean;
  groupId: string | null;
  onClose: () => void;
  onCreated: (recipe: Recipe) => void;
}) {
  const userId = useAppStore((state) => state.userId);

  async function handleSubmit(input: RecipeInput) {
    if (!userId) return;
    const created = await createRecipe(userId, groupId, input);
    onCreated(created);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add recipe</DialogTitle>
      {/* Extra top padding — otherwise the first field's floating label
          clips against the dialog content's scroll edge once focused. */}
      <DialogContent sx={{ pt: '12px !important' }}>
        <RecipeForm submitLabel="Add recipe" onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  );
}
