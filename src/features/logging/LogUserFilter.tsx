import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useGroupMembers } from "../groups/useGroupMembers";
import { useProfileNames } from "../profiles/useProfileNames";

// "Filter by" control narrowing a group log view (DailyLog.tsx,
// AllTimeLog.tsx) to one member's own entries (matched against
// `logged_for`), or every member's (`value: null`) unfiltered. Options are
// this group's own members — same source and "hide it entirely for a solo
// group" bailout as LoggedForSelector.tsx, since there's nothing to filter
// between with only one member.
export function LogUserFilter({
  groupId,
  value,
  onChange,
}: {
  groupId: string;
  value: string | null;
  onChange: (userId: string | null) => void;
}) {
  const members = useGroupMembers(groupId);
  const names = useProfileNames(
    (members ?? []).map((member) => member.user_id),
  );

  if (!members || members.length <= 1) return null;

  return (
    <TextField
      select
      label="Filter by"
      value={value ?? "__all__"}
      onChange={(e) =>
        onChange(e.target.value === "__all__" ? null : e.target.value)
      }
      size="small"
      sx={{ alignSelf: "flex-start", minWidth: 160 }}
    >
      <MenuItem value="__all__">Everyone</MenuItem>
      {members.map((member) => (
        <MenuItem key={member.user_id} value={member.user_id}>
          {names[member.user_id] ?? "Loading…"}
        </MenuItem>
      ))}
    </TextField>
  );
}
