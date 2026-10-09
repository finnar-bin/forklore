import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

// In the bottom-docked mobile dialog sheet there's no room below a field once
// the keyboard is up, so autocomplete lists open upward and are capped to the
// visible area (--vv-height from useVisualViewportVars).
export function useSheetAutocompleteSlotProps() {
  const small = useMediaQuery(useTheme().breakpoints.down("sm"));
  if (!small) return undefined;
  return {
    popper: {
      placement: "top-start" as const,
      modifiers: [{ name: "flip", enabled: false }],
    },
    listbox: { sx: { maxHeight: "calc(var(--vv-height, 100vh) * 0.45)" } },
  };
}
