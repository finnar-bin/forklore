import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useAppStore } from "../../store/useAppStore";
import { createRecipe } from "./api";
import { RecipeForm } from "./RecipeForm";
import type { Recipe, RecipeInput } from "../../types/recipe";

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
  // Generated up front (not by createRecipe) so a staged photo can be
  // uploaded under this same id before the row itself exists — see
  // RecipeForm.tsx/DeferredPhotoUpload.tsx.
  //
  // Regenerated on every open, not just once per mount — see
  // CreateIngredientDialog.tsx's identical comment for why a plain
  // `useState(() => crypto.randomUUID())` would be wrong here (this
  // component stays mounted across dialog open/close cycles). Currently
  // masked in practice by RecipeList's onCreated always navigating away
  // (which unmounts/remounts this component), but fixed here defensively
  // rather than relying on that navigation behavior never changing.
  const [pendingId, setPendingId] = useState(() => crypto.randomUUID());
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPendingId(crypto.randomUUID());
    }
  }

  async function handleSubmit(input: RecipeInput) {
    if (!userId) return;
    const created = await createRecipe(pendingId, userId, groupId, input);
    onCreated(created);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add recipe</DialogTitle>
      {/* Extra top padding — otherwise the first field's floating label
          clips against the dialog content's scroll edge once focused. */}
      <DialogContent sx={{ pt: "12px !important" }}>
        <RecipeForm
          recipeId={pendingId}
          submitLabel="Add recipe"
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
