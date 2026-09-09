import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { formatKcalPerUnit } from "../../lib/kcal";
import { useAppStore } from "../../store/useAppStore";
import { fetchIngredients } from "../pantry/api";
import { IngredientAutocompleteOption } from "../pantry/IngredientAutocompleteOption";
import { fetchRecipes } from "../recipes/api";
import { useMyGroups } from "../groups/useMyGroups";
import { useMemberKcalProfiles } from "../profiles/useMemberKcalProfiles";
import { createLogEntry, type LogEntryInput } from "./api";
import { formatIngredientLabel, formatRecipeLabel } from "./formatItemLabel";
import { LogIngredientStep } from "./LogIngredientStep";
import { LogRecipeStep } from "./LogRecipeStep";
import type { GroupMembership } from "../../types/group";
import type { Ingredient } from "../../types/ingredient";
import type { LogEntry } from "../../types/log";
import type { Recipe } from "../../types/recipe";

// A stable reference (not a fresh `[]` literal on every render) so the
// ingredients/recipes effect below — keyed on `groups` — doesn't re-run on
// every render while useMyGroups is still loading.
const EMPTY_GROUPS: GroupMembership[] = [];

// Primary "log an entry by selecting an existing ingredient or recipe" flow
// (Ticket 8 scope). Same toggle + select-then-detail shape as
// AddRecipeIngredientDialog's "From pantry" step, applied to a type toggle
// instead of an existing/new toggle.
//
// Group-locked (docs/pending-deviations.md, "Log entry dialog group-locked"):
// only lists ingredients/recipes belonging to `groupId` (the group screen
// this was opened from), merged with community ingredients if — and only
// if — that specific group has its own community pantry setting enabled.
// Matches AddRecipeIngredientDialog's identical scoping exactly (same
// fetchIngredients/fetchRecipes calls, same per-group community check).
// The resulting entry always lands on `groupId`'s own log, including for a
// picked community ingredient (whose own group_id is null — it isn't owned
// by any group).
export function AddLogEntryDialog({
  open,
  groupId,
  onClose,
  onLogged,
}: {
  open: boolean;
  // The group screen this was opened from (DailyLog's own groupId prop) —
  // the only group this dialog's picker draws from. See the file-level
  // comment above.
  groupId: string;
  onClose: () => void;
  onLogged: (entry: LogEntry) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Log an entry</DialogTitle>
      {/* Mounted only while open, so selection state starts fresh each time. */}
      {open && (
        <AddLogEntryForm
          contextGroupId={groupId}
          onClose={onClose}
          onLogged={onLogged}
        />
      )}
    </Dialog>
  );
}

function AddLogEntryForm({
  contextGroupId,
  onClose,
  onLogged,
}: {
  contextGroupId: string;
  onClose: () => void;
  onLogged: (entry: LogEntry) => void;
}) {
  const userId = useAppStore((state) => state.userId);
  const [type, setType] = useState<"ingredient" | "recipe">("ingredient");

  // Shared cache (see useMyGroups) rather than this dialog's own fetch — it
  // remounts fresh every time it opens ("selection state starts fresh each
  // time" above), which used to mean a fresh group_members fetch every tap
  // of the Log FAB. Only used to resolve `contextGroupId`'s own name and its
  // own community pantry setting — see AddRecipeIngredientDialog's identical
  // derivation.
  const groups = useMyGroups(userId) ?? EMPTY_GROUPS;
  const membership = groups.find((m) => m.group.id === contextGroupId);
  const communityEnabled = membership?.group.community_pantry_enabled ?? false;
  const [ingredients, setIngredients] = useState<Ingredient[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [selectedIngredient, setSelectedIngredient] =
    useState<Ingredient | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  // Who the entry-to-be counts against — defaults to the caller, and reset
  // back to them on every selection change so a picker from a *previous*
  // group's LoggedForSelector can't linger onto an item from a different
  // group whose members don't overlap. Only ever surfaced as an actual
  // picker (see LogIngredientStep/LogRecipeStep) when the resolved group has
  // more than one member; otherwise it's just always the caller.
  const [loggedFor, setLoggedFor] = useState(userId ?? "");
  useEffect(() => {
    setLoggedFor(userId ?? "");
  }, [userId, selectedIngredient, selectedRecipe]);

  // Whether *loggedFor's own* profile has opted into meal-type breakdown —
  // requested directly: the meal-type selector should reflect whichever
  // person the entry will actually count against, not always the caller's
  // own preference (relevant now that they can differ — see LoggedForSelector).
  // Re-fetches automatically whenever `loggedFor` changes, so switching who
  // it's for immediately reflects that person's own setting. `false` (hidden)
  // while the fetch is in flight, same "pops in once resolved" treatment as
  // this dialog's own `hasGroups`/community-pantry-driven UI elsewhere.
  const loggedForProfiles = useMemberKcalProfiles(loggedFor ? [loggedFor] : []);
  const mealBreakdownEnabled =
    loggedForProfiles[loggedFor]?.meal_breakdown_enabled ?? false;

  useEffect(() => {
    if (!userId) return;
    fetchIngredients(contextGroupId, communityEnabled)
      .then(setIngredients)
      .catch(() => setIngredients([]));
    fetchRecipes(contextGroupId)
      .then(setRecipes)
      .catch(() => setRecipes([]));
  }, [userId, contextGroupId, communityEnabled]);

  // Every option is either owned by `contextGroupId` or (for an ingredient)
  // community — "Community" vs. this group's own name is the only thing
  // left to distinguish, same as AddRecipeIngredientDialog's identical
  // helper. A community *recipe* doesn't exist (recipes have no community
  // tier), so `isCommunity` is only ever passed for ingredients.
  function groupLabel(isCommunity?: boolean): string {
    if (isCommunity) return "Community";
    return membership?.group.name ?? "Group";
  }

  async function handleLog(input: LogEntryInput) {
    if (!userId) return;
    const entry = await createLogEntry(
      userId,
      loggedFor,
      contextGroupId,
      input,
    );
    onLogged(entry);
  }

  if (type === "ingredient" && selectedIngredient) {
    return (
      <LogIngredientStep
        ingredient={selectedIngredient}
        groupLabel={groupLabel(selectedIngredient.is_community)}
        loggedFor={loggedFor}
        onLoggedForChange={setLoggedFor}
        loggedForGroupId={contextGroupId}
        mealBreakdownEnabled={mealBreakdownEnabled}
        onLog={handleLog}
        onCancel={() => setSelectedIngredient(null)}
      />
    );
  }

  if (type === "recipe" && selectedRecipe) {
    return (
      <LogRecipeStep
        recipe={selectedRecipe}
        groupLabel={groupLabel()}
        loggedFor={loggedFor}
        onLoggedForChange={setLoggedFor}
        loggedForGroupId={contextGroupId}
        mealBreakdownEnabled={mealBreakdownEnabled}
        onLog={handleLog}
        onCancel={() => setSelectedRecipe(null)}
      />
    );
  }

  return (
    <>
      <DialogContent sx={{ pt: "12px !important" }}>
        <Stack spacing={2.5}>
          <ToggleButtonGroup
            value={type}
            exclusive
            onChange={(_, value) => value && setType(value)}
            size="small"
            fullWidth
          >
            <ToggleButton value="ingredient">Ingredient</ToggleButton>
            <ToggleButton value="recipe">Recipe</ToggleButton>
          </ToggleButtonGroup>

          {type === "ingredient" ? (
            ingredients === null ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : ingredients.length === 0 ? (
              <Alert severity="info">
                Your pantry is empty. Add an ingredient first.
              </Alert>
            ) : (
              <Autocomplete
                options={ingredients}
                getOptionKey={(option) => option.id}
                getOptionLabel={formatIngredientLabel}
                onChange={(_, value) => setSelectedIngredient(value)}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                filterOptions={createFilterOptions({
                  trim: true,
                  stringify: (option) => option.name,
                })}
                renderOption={({ key, ...liProps }, option) => (
                  <IngredientAutocompleteOption
                    key={key}
                    liProps={liProps}
                    ingredient={option}
                    groupLabel={groupLabel(option.is_community)}
                  />
                )}
                renderInput={(params) => (
                  <TextField {...params} label="Ingredient" autoFocus />
                )}
              />
            )
          ) : recipes === null ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : recipes.length === 0 ? (
            <Alert severity="info">
              Your recipes are empty. Add a recipe first.
            </Alert>
          ) : (
            <Autocomplete
              options={recipes}
              getOptionKey={(option) => option.id}
              getOptionLabel={formatRecipeLabel}
              onChange={(_, value) => setSelectedRecipe(value)}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              filterOptions={createFilterOptions({
                trim: true,
                stringify: (option) => option.name,
              })}
              renderOption={({ key, ...liProps }, option) => (
                <Box
                  component="li"
                  key={key}
                  {...liProps}
                  sx={{ display: "flex", gap: 1.5, alignItems: "center" }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 0.5,
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        noWrap
                        sx={{
                          fontSize: 14,
                          fontWeight: 500,
                          minWidth: 0,
                        }}
                      >
                        {option.name}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: 14,
                          color: "text.secondary",
                          flexShrink: 0,
                        }}
                      >
                        {option.weight_g} g
                      </Typography>
                    </Box>
                    <Typography
                      noWrap
                      sx={{
                        fontSize: 12,
                        color: "text.secondary",
                      }}
                    >
                      {groupLabel()}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    <Typography
                      sx={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "primary.main",
                      }}
                    >
                      {option.total_kcal.toFixed(2)} kcal
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: "text.secondary",
                      }}
                    >
                      {formatKcalPerUnit(option.total_kcal, option.weight_g)}/g
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField {...params} label="Recipe" autoFocus />
              )}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </>
  );
}
