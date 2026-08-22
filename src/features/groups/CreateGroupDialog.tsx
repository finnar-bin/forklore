import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { createGroup, type GroupInput } from './api';
import { GroupForm } from './GroupForm';
import type { Group } from '../../types/group';

export function CreateGroupDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (group: Group) => void;
}) {
  async function handleSubmit(input: GroupInput) {
    const created = await createGroup(input);
    onCreated(created);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create group</DialogTitle>
      {/* Extra top padding — otherwise the first field's floating label
          clips against the dialog content's scroll edge once focused
          (same fix as CreateRecipeDialog). */}
      <DialogContent sx={{ pt: '12px !important' }}>
        <GroupForm submitLabel="Create group" onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  );
}
