import { useEffect, useMemo, useState, type HTMLAttributes } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Alert from "@mui/material/Alert";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSheetAutocompleteSlotProps } from "../../components/useSheetAutocompleteSlotProps";
import { db } from "../../lib/db";
import { formatKcalPerUnit, formatKcal } from "../../lib/kcal";
import { useAppStore } from "../../store/useAppStore";
import { fetchIngredients } from "../pantry/api";
import { ingredientSearchText } from "../pantry/ingredientSearch";
import { IngredientAutocompleteOption } from "../pantry/IngredientAutocompleteOption";
import { fetchRecipes } from "../recipes/api";
import { resolveGroupLabel } from "../groups/groupLabel";
import { useMyGroups } from "../groups/useMyGroups";
import { useMemberKcalProfiles } from "../profiles/useMemberKcalProfiles";
import { createLogEntry, type LogEntryInput } from "./api";
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
  const sheetSlotProps = useSheetAutocompleteSlotProps();

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
  // left to distinguish, same as AddRecipeIngredientDialog's identical call.
  // A community *recipe* doesn't exist (recipes have no community tier), so
  // `isCommunity` is only ever passed for ingredients.
  function groupLabel(isCommunity?: boolean): string {
    return resolveGroupLabel(membership?.group.name, isCommunity);
  }

  // Newest-first entries on this group's log by the person logging, used for
  // the "Recent" chips and each item's last-used quantity.
  const recentEntries = useLiveQuery(
    () =>
      db.log_entries
        .where("group_id")
        .equals(contextGroupId)
        .filter((e) => e.created_by === userId)
        .toArray()
        .then((rows) =>
          rows.sort((a, b) =>
            b.created_at < a.created_at
              ? -1
              : b.created_at > a.created_at
                ? 1
                : 0,
          ),
        ),
    [contextGroupId, userId],
  );

  const options: PickOption[] = useMemo(
    () =>
      [
        ...(ingredients ?? []).map((item): PickOption => ({
          kind: "ingredient",
          item,
        })),
        ...(recipes ?? []).map((item): PickOption => ({
          kind: "recipe",
          item,
        })),
      ].sort((a, b) => a.item.name.localeCompare(b.item.name)),
    [ingredients, recipes],
  );

  const lastQuantity = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of recentEntries ?? []) {
      const id = e.source_ingredient_id ?? e.source_recipe_id;
      if (id && !map.has(id)) map.set(id, e.quantity);
    }
    return map;
  }, [recentEntries]);

  const recentOptions = useMemo(() => {
    const byId = new Map(options.map((o) => [o.item.id, o]));
    return [...lastQuantity.keys()]
      .map((id) => byId.get(id))
      .filter((o): o is PickOption => o !== undefined)
      .slice(0, 6);
  }, [lastQuantity, options]);

  function pick(option: PickOption | null) {
    if (!option) return;
    if (option.kind === "ingredient") setSelectedIngredient(option.item);
    else setSelectedRecipe(option.item);
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

  if (selectedIngredient) {
    return (
      <LogIngredientStep
        ingredient={selectedIngredient}
        groupLabel={groupLabel(selectedIngredient.is_community)}
        loggedFor={loggedFor}
        onLoggedForChange={setLoggedFor}
        loggedForGroupId={contextGroupId}
        mealBreakdownEnabled={mealBreakdownEnabled}
        initialQuantity={lastQuantity.get(selectedIngredient.id)}
        onLog={handleLog}
        onCancel={() => setSelectedIngredient(null)}
      />
    );
  }

  if (selectedRecipe) {
    return (
      <LogRecipeStep
        recipe={selectedRecipe}
        groupLabel={groupLabel()}
        loggedFor={loggedFor}
        onLoggedForChange={setLoggedFor}
        loggedForGroupId={contextGroupId}
        mealBreakdownEnabled={mealBreakdownEnabled}
        initialQuantity={lastQuantity.get(selectedRecipe.id)}
        onLog={handleLog}
        onCancel={() => setSelectedRecipe(null)}
      />
    );
  }

  const loading = ingredients === null || recipes === null;
  const empty = !loading && options.length === 0;

  return (
    <>
      <DialogContent sx={{ pt: "12px !important" }}>
        <Stack spacing={2}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : empty ? (
            <Alert severity="info">
              Nothing to log yet. Add an ingredient or recipe first.
            </Alert>
          ) : (
            <>
              <Autocomplete<PickOption>
                slotProps={sheetSlotProps}
                options={options}
                value={null}
                getOptionKey={(option) => option.item.id}
                getOptionLabel={(option) => option.item.name}
                onChange={(_, value) => pick(value)}
                isOptionEqualToValue={(option, value) =>
                  option.item.id === value.item.id
                }
                filterOptions={createFilterOptions({
                  trim: true,
                  stringify: (option) =>
                    option.kind === "ingredient"
                      ? ingredientSearchText(option.item)
                      : option.item.name,
                })}
                renderOption={({ key, ...liProps }, option) =>
                  option.kind === "ingredient" ? (
                    <IngredientAutocompleteOption
                      key={key}
                      liProps={liProps}
                      ingredient={option.item}
                      groupLabel={groupLabel(option.item.is_community)}
                    />
                  ) : (
                    <RecipeOption
                      key={key}
                      liProps={liProps}
                      recipe={option.item}
                      groupLabel={groupLabel()}
                    />
                  )
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search ingredients & recipes"
                    autoFocus
                  />
                )}
              />
              {recentOptions.length > 0 && (
                <Box>
                  <Typography
                    sx={{ fontSize: 12, color: "text.secondary", mb: 0.75 }}
                  >
                    Recent
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{ flexWrap: "wrap" }}
                  >
                    {recentOptions.map((o) => (
                      <Chip
                        key={o.item.id}
                        clickable
                        label={o.item.name}
                        onClick={() => pick(o)}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </>
  );
}

type PickOption =
  { kind: "ingredient"; item: Ingredient } | { kind: "recipe"; item: Recipe };

function RecipeOption({
  liProps,
  recipe,
  groupLabel,
}: {
  liProps: HTMLAttributes<HTMLLIElement>;
  recipe: Recipe;
  groupLabel: string;
}) {
  return (
    <Box
      component="li"
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
            sx={{ fontSize: 14, fontWeight: 500, minWidth: 0 }}
          >
            {recipe.name}
          </Typography>
          <Typography
            sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }}
          >
            {recipe.weight_g} g
          </Typography>
        </Box>
        <Typography noWrap sx={{ fontSize: 12, color: "text.secondary" }}>
          Recipe · {groupLabel}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography
          sx={{ fontSize: 14, fontWeight: 500, color: "primary.dark" }}
        >
          {formatKcal(recipe.total_kcal)} kcal
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {formatKcalPerUnit(recipe.total_kcal, recipe.weight_g)}/g
        </Typography>
      </Box>
    </Box>
  );
}
