import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useColorScheme } from '@mui/material/styles';
import { shadows } from '../../theme/theme';
import { removeRecipeIngredient, updateRecipeIngredientQuantity } from './api';
import { AddRecipeIngredientDialog } from './AddRecipeIngredientDialog';
import type { RecipeIngredientDetail } from './api';

export function RecipeIngredientsList({
  recipeId,
  ingredients,
  onChanged,
}: {
  recipeId: string;
  ingredients: RecipeIngredientDetail[];
  onChanged: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography fontSize={13} fontWeight={500} color="text.secondary">
          Ingredients
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => setAddOpen(true)}
        >
          Add ingredient
        </Button>
      </Stack>

      {ingredients.length === 0 ? (
        <Typography color="text.secondary" fontSize={13} sx={{ py: 2 }}>
          No ingredients yet. Add some from your pantry.
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          {ingredients.map((item) => (
            <RecipeIngredientRow
              key={item.ingredient_id}
              recipeId={recipeId}
              item={item}
              onChanged={onChanged}
            />
          ))}
        </Stack>
      )}

      <AddRecipeIngredientDialog
        open={addOpen}
        recipeId={recipeId}
        excludeIngredientIds={ingredients.map((i) => i.ingredient_id)}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          setAddOpen(false);
          onChanged();
        }}
      />
    </Box>
  );
}

function RecipeIngredientRow({
  recipeId,
  item,
  onChanged,
}: {
  recipeId: string;
  item: RecipeIngredientDetail;
  onChanged: () => void;
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  const [quantity, setQuantity] = useState(item.quantity_used.toString());
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const kcalContribution =
    item.quantity > 0 ? (item.kcal * item.quantity_used) / item.quantity : 0;

  async function commitQuantity() {
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed === item.quantity_used) {
      setQuantity(item.quantity_used.toString());
      return;
    }
    setSaving(true);
    try {
      await updateRecipeIngredientQuantity(recipeId, item.ingredient_id, parsed);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await removeRecipeIngredient(recipeId, item.ingredient_id);
      onChanged();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: '12px',
        boxShadow: tokens.sh1,
        p: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontSize={13} noWrap>
          {item.name}
        </Typography>
        <Typography fontSize={11} color="text.secondary">
          {kcalContribution.toFixed(0)} kcal
        </Typography>
      </Box>

      <TextField
        type="number"
        size="small"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        onBlur={commitQuantity}
        disabled={saving || removing}
        slotProps={{ htmlInput: { min: 0, step: 0.01, style: { textAlign: 'right' } } }}
        sx={{ width: 88 }}
      />
      <Typography fontSize={12} color="text.secondary" sx={{ minWidth: 32 }}>
        {item.unit}
      </Typography>

      <IconButton
        aria-label={`Remove ${item.name}`}
        size="small"
        onClick={handleRemove}
        disabled={removing}
      >
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
