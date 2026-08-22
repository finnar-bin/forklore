import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import type { CopyTarget } from './useCopyTargets';

// Shared "pick a target context" step for CopyIngredientDialog and
// CopyRecipeDialog — a plain radio-style list, matching the restrained list
// patterns already used elsewhere (e.g. DeleteIngredientDialog's usage
// list). See docs/pending-deviations.md (Ticket 14).
export function CopyTargetList({
  targets,
  selectedIndex,
  onSelect,
}: {
  targets: CopyTarget[] | null;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  if (targets === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (targets.length === 0) {
    return (
      <Alert severity="info">
        There's nowhere else to copy this to yet — join or create a group first.
      </Alert>
    );
  }

  return (
    <List dense disablePadding>
      {targets.map((target, index) => (
        <ListItemButton
          key={target.groupId ?? 'personal'}
          selected={selectedIndex === index}
          onClick={() => onSelect(index)}
          sx={{ borderRadius: '10px' }}
        >
          <Radio checked={selectedIndex === index} size="small" sx={{ mr: 1 }} />
          <ListItemText primary={target.label} />
        </ListItemButton>
      ))}
    </List>
  );
}
