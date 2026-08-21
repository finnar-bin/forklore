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
import { fetchRecipes } from './api';
import { RecipeCard } from './RecipeCard';
import { CreateRecipeDialog } from './CreateRecipeDialog';
import type { Recipe } from '../../types/recipe';

export function RecipeList() {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchRecipes(userId)
      .then(setRecipes)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your recipes.'))
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

        {!loading && !error && recipes.length === 0 && (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            Your recipes are empty. Add your first recipe to get started.
          </Typography>
        )}

        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onClick={() => navigate(`/recipes/${recipe.id}`)}
          />
        ))}
      </Stack>

      <Fab
        color="primary"
        aria-label="Add recipe"
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

      <CreateRecipeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          // Straight to detail, not back to the list — a brand-new recipe has
          // no ingredients yet, and that's the very next thing to add.
          navigate(`/recipes/${created.id}`, { replace: true });
        }}
      />
    </Box>
  );
}
