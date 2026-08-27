import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useGroupMembers } from "../groups/useGroupMembers";
import { useProfileNames } from "../profiles/useProfileNames";

// "Log for" picker — who a group-owned entry counts against, defaulting to
// the caller themselves (see AddLogEntryDialog's own loggedFor state).
// Requested directly: letting one member log an entry on a fellow member's
// behalf. Only rendered by LogIngredientStep/LogRecipeStep when the item
// being logged belongs to a group (a personal item has no group to
// delegate within — see createLogEntry's own comment) and that group has
// more than one member (nothing to pick between otherwise).
export function LoggedForSelector({
  groupId,
  value,
  onChange,
  disabled,
}: {
  groupId: string;
  value: string;
  onChange: (userId: string) => void;
  disabled?: boolean;
}) {
  const members = useGroupMembers(groupId);
  const names = useProfileNames(
    (members ?? []).map((member) => member.user_id),
  );

  if (!members || members.length <= 1) return null;

  return (
    <TextField
      select
      label="Log for"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      fullWidth
    >
      {members.map((member) => (
        <MenuItem key={member.user_id} value={member.user_id}>
          {names[member.user_id] ?? "Loading…"}
        </MenuItem>
      ))}
    </TextField>
  );
}
