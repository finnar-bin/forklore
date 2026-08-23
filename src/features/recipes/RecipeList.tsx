import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { useAppStore } from '../../store/useAppStore';
import { FloatingPortal } from '../../components/FloatingPortal';
import { useProfileNames } from '../profiles/useProfileNames';
import { fetchRecipes } from './api';
import { RecipeCard } from './RecipeCard';
import { CreateRecipeDialog } from './CreateRecipeDialog';

export function RecipeList({ groupId }: { groupId: string | null }) {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);

  // Reads from Dexie, not Supabase — re-renders automatically on local
  // writes (this device) and pulled remote changes alike.
  const recipes = useLiveQuery(() => (userId ? fetchRecipes(userId, groupId) : []), [userId, groupId]);
  const loading = recipes === undefined;
  const detailPath = groupId ? `/groups/${groupId}/recipes` : '/recipes';

  // Group context only — see RecipeCard's creatorName prop and
  // docs/pending-deviations.md (Ticket 12).
  const creatorNames = useProfileNames(groupId ? (recipes ?? []).map((r) => r.created_by) : []);

  return (
    // Root box, not a nested wrapper — see design-system.md's FAB positioning
    // note. The FAB itself uses position: fixed (anchored to the viewport),
    // not absolute — absolute anchored it to this box, which grows with the
    // list, pushing the FAB off-screen once the list got long. It's also
    // wrapped in FloatingPortal (Ticket 16) so AnimatedAppShell's animated
    // transform doesn't hijack its fixed positioning.
    <Box sx={{ position: 'relative', minHeight: 'calc(100vh - 64px)' }}>
      {/* pb clears both the FAB (bottom: 80) and BottomNav below it — see
          docs/pending-deviations.md (Ticket 16). */}
      <Stack spacing={1.5} sx={{ p: 2, maxWidth: 480, mx: 'auto', pb: 18 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && recipes?.length === 0 && (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            {groupId
              ? "This group's recipes are empty. Add the first recipe to get started."
              : 'Your recipes are empty. Add your first recipe to get started.'}
          </Typography>
        )}

        {(recipes ?? []).map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            creatorName={groupId ? creatorNames[recipe.created_by] : undefined}
            onClick={() => navigate(`${detailPath}/${recipe.id}`)}
          />
        ))}
      </Stack>

      <FloatingPortal>
        <Fab
          color="primary"
          aria-label="Add recipe"
          onClick={() => setCreateOpen(true)}
          sx={{
            position: 'fixed',
            // Recipes is a bottom-tab root, so it clears BottomNav — see
            // docs/pending-deviations.md (Ticket 16).
            right: 16,
            bottom: 80,
            boxShadow: (theme) =>
              theme.palette.mode === 'dark'
                ? '0 6px 14px rgba(0,0,0,.5)'
                : '0 6px 14px rgba(93,110,1,.35)',
          }}
        >
          <AddIcon />
        </Fab>
      </FloatingPortal>

      <CreateRecipeDialog
        open={createOpen}
        groupId={groupId}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          // Straight to detail, not back to the list — a brand-new recipe has
          // no ingredients yet, and that's the very next thing to add.
          navigate(`${detailPath}/${created.id}`, { replace: true });
        }}
      />
    </Box>
  );
}
