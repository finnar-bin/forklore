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
import { AddRecipeIngredientDialog } from './AddRecipeIngredientDialog';
import type { RecipeIngredientDetail } from '../../types/recipe';
import type { Ingredient } from '../../types/ingredient';

// Every change here (add/remove/quantity edit) only touches the in-memory
// draft passed down from RecipeDetail — nothing is written to Supabase until
// the page-level Save button is clicked.
export function RecipeIngredientsList({
  groupId,
  ingredients,
  disabled,
  onAdd,
  onQuantityChange,
  onRemove,
}: {
  groupId: string | null;
  ingredients: RecipeIngredientDetail[];
  disabled: boolean;
  onAdd: (ingredient: Ingredient, quantityUsed: number) => void;
  onQuantityChange: (ingredientId: string, quantityUsed: number) => void;
  onRemove: (ingredientId: string) => void;
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
          disabled={disabled}
        >
          Add ingredient
        </Button>
      </Stack>

      {ingredients.length === 0 ? (
        <Typography color="text.secondary" fontSize={13} sx={{ py: 2 }}>
          No ingredients yet. Add some from your pantry.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {ingredients.map((item) => (
            <RecipeIngredientRow
              key={item.ingredient_id}
              item={item}
              disabled={disabled}
              onQuantityChange={onQuantityChange}
              onRemove={onRemove}
            />
          ))}
        </Stack>
      )}

      <AddRecipeIngredientDialog
        open={addOpen}
        groupId={groupId}
        excludeIngredientIds={ingredients.map((i) => i.ingredient_id)}
        onClose={() => setAddOpen(false)}
        onAdd={(ingredient, quantityUsed) => {
          onAdd(ingredient, quantityUsed);
          setAddOpen(false);
        }}
      />
    </Box>
  );
}

function RecipeIngredientRow({
  item,
  disabled,
  onQuantityChange,
  onRemove,
}: {
  item: RecipeIngredientDetail;
  disabled: boolean;
  onQuantityChange: (ingredientId: string, quantityUsed: number) => void;
  onRemove: (ingredientId: string) => void;
}) {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === 'system' ? systemMode : mode;
  const tokens = resolvedMode === 'dark' ? shadows.dark : shadows.light;

  // Local raw text, separate from the committed draft value — lets the user
  // pass through intermediate states like "1." while typing "1.5" without
  // the controlled input snapping back on every keystroke. Only a valid
  // positive number is pushed up to the parent (and the realtime kcal total).
  const [rawQuantity, setRawQuantity] = useState(item.quantity_used.toString());

  const kcalContribution =
    item.quantity > 0 ? (item.kcal * item.quantity_used) / item.quantity : 0;

  function handleChange(value: string) {
    setRawQuantity(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      onQuantityChange(item.ingredient_id, parsed);
    }
  }

  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: 'background.paper',
        borderRadius: '12px',
        boxShadow: tokens.sh1,
        border: item.is_community ? '2px solid' : 'none',
        borderColor: item.is_community ? 'secondary.main' : undefined,
        p: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {/* Small tab overlapping the row's own top-left corner — same
          community indicator as IngredientCard.tsx, see
          docs/pending-deviations.md ("Community pantry"). */}
      {item.is_community && (
        <Box
          sx={{
            position: 'absolute',
            top: -9,
            left: 10,
            bgcolor: 'secondary.main',
            color: 'secondary.contrastText',
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1,
            px: 0.75,
            py: 0.375,
            borderRadius: '4px',
          }}
        >
          Community
        </Box>
      )}
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
        value={rawQuantity}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        slotProps={{ htmlInput: { min: 0, step: 0.01, style: { textAlign: 'right' } } }}
        sx={{ width: 88 }}
      />
      <Typography fontSize={12} color="text.secondary" sx={{ minWidth: 32 }}>
        {item.unit}
      </Typography>

      <IconButton
        aria-label={`Remove ${item.name}`}
        size="small"
        onClick={() => onRemove(item.ingredient_id)}
        disabled={disabled}
      >
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
