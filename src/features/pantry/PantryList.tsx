import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { useAppStore } from '../../store/useAppStore';
import { fetchIngredients } from './api';
import { IngredientCard } from './IngredientCard';
import { CreateIngredientDialog } from './CreateIngredientDialog';
import type { Ingredient } from '../../types/ingredient';

export function PantryList() {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchIngredients(userId)
      .then(setIngredients)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your pantry.'))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    // Root box, not a nested wrapper — see design-system.md's FAB positioning
    // note. The FAB itself uses position: fixed (anchored to the viewport),
    // not absolute — absolute anchored it to this box, which grows with the
    // list, pushing the FAB off-screen once the list got long.
    <Box sx={{ position: 'relative', minHeight: 'calc(100vh - 64px)' }}>
      <Stack spacing={1.5} sx={{ p: 2, maxWidth: 480, mx: 'auto', pb: 10 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {!loading && !error && ingredients.length === 0 && (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            Your pantry is empty. Add your first ingredient to get started.
          </Typography>
        )}

        {ingredients.map((ingredient) => (
          <IngredientCard
            key={ingredient.id}
            ingredient={ingredient}
            onClick={() => navigate(`/pantry/${ingredient.id}`)}
          />
        ))}
      </Stack>

      <Fab
        color="primary"
        aria-label="Add ingredient"
        onClick={() => setCreateOpen(true)}
        sx={{
          position: 'fixed',
          right: 16,
          bottom: 24,
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 6px 14px rgba(0,0,0,.5)'
              : '0 6px 14px rgba(93,110,1,.35)',
        }}
      >
        <AddIcon />
      </Fab>

      <CreateIngredientDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          setIngredients((prev) =>
            [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
          );
          setCreateOpen(false);
        }}
      />
    </Box>
  );
}
