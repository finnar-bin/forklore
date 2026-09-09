// Shared by every picker that shows a group-owned item alongside community
// ones (AddLogEntryDialog.tsx, AddRecipeIngredientDialog.tsx) — both scope
// their own options to a single group plus, optionally, community items
// (docs/pending-deviations.md, "Community pantry"), so all that's ever left
// to distinguish is "Community" vs. that one group's own name.
export function resolveGroupLabel(
  groupName: string | null | undefined,
  isCommunity?: boolean,
): string {
  if (isCommunity) return "Community";
  return groupName ?? "Group";
}
