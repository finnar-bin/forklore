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
import { fetchIngredients } from './api';
import { IngredientCard } from './IngredientCard';
import { CreateIngredientDialog } from './CreateIngredientDialog';

export function PantryList({ groupId }: { groupId: string | null }) {
  const userId = useAppStore((state) => state.userId);
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);

  // Reads from Dexie, not Supabase — re-renders automatically on local
  // writes (this device) and pulled remote changes alike, so no manual
  // refetch/merge is needed after create/delete.
  const ingredients = useLiveQuery(
    () => (userId ? fetchIngredients(userId, groupId) : []),
    [userId, groupId],
  );
  const loading = ingredients === undefined;
  const detailPath = groupId ? `/groups/${groupId}/pantry` : '/pantry';

  // Group context only — see IngredientCard's creatorName prop and
  // docs/pending-deviations.md (Ticket 12).
  const creatorNames = useProfileNames(groupId ? (ingredients ?? []).map((i) => i.created_by) : []);

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

        {!loading && ingredients?.length === 0 && (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            {groupId
              ? "This group's pantry is empty. Add the first ingredient to get started."
              : 'Your pantry is empty. Add your first ingredient to get started.'}
          </Typography>
        )}

        {(ingredients ?? []).map((ingredient) => (
          <IngredientCard
            key={ingredient.id}
            ingredient={ingredient}
            creatorName={groupId ? creatorNames[ingredient.created_by] : undefined}
            onClick={() => navigate(`${detailPath}/${ingredient.id}`)}
          />
        ))}
      </Stack>

      <FloatingPortal>
        <Fab
          color="primary"
          aria-label="Add ingredient"
          onClick={() => setCreateOpen(true)}
          sx={{
            position: 'fixed',
            // Pantry is a bottom-tab root, so it clears BottomNav — see
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

      <CreateIngredientDialog
        open={createOpen}
        groupId={groupId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setCreateOpen(false)}
      />
    </Box>
  );
}
