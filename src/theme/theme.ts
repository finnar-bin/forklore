import { createTheme } from "@mui/material/styles";

// Defined once and reused below (in both colorSchemes and primaryAccent) so
// the two can't drift — see primaryAccent's own comment for why a second,
// literal-value copy exists at all.
const PRIMARY_LIGHT = "#8DA101";
const PRIMARY_DARK = "#A7C080";

// Everforest palette — see docs/mocks/design-system.md
export const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        background: { default: "#F3EAD3", paper: "#FDF6E3" },
        // `dark` is the text-safe shade (>=4.5:1 on paper); `main` stays for fills.
        primary: { main: PRIMARY_LIGHT, dark: "#5F6F00" },
        secondary: { main: "#DFA000" },
        error: { main: "#F85552" },
        text: { primary: "#4A555A", secondary: "#667370" },
      },
    },
    dark: {
      palette: {
        background: { default: "#232A2E", paper: "#2D373C" },
        primary: { main: PRIMARY_DARK, dark: PRIMARY_DARK },
        secondary: { main: "#DBBC7F" },
        error: { main: "#E67E80" },
        text: { primary: "#D3C6AA", secondary: "#9AA394" },
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: '"Inter", sans-serif' },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    // Ripple is off globally, so keyboard focus needs its own visible ring.
    MuiCssBaseline: {
      styleOverrides: (theme) => ({
        body: { fontVariantNumeric: "tabular-nums" },
        ":focus-visible": {
          outline: `2px solid ${theme.palette.primary.dark}`,
          outlineOffset: 2,
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "0.01ms !important",
            animationIterationCount: "1 !important",
            transitionDuration: "0.01ms !important",
          },
        },
      }),
    },
    MuiIconButton: {
      styleOverrides: {
        root: { "@media (pointer: coarse)": { minWidth: 44, minHeight: 44 } },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: ({ ownerState, theme }) => ({
          textTransform: "none",
          fontWeight: 500,
          // Text-style buttons ("View All", "Edit") render as text on paper.
          ...(ownerState.variant === "text" &&
            ownerState.color === "primary" && {
              color: theme.palette.primary.dark,
            }),
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    // Below `sm`, dialogs dock to the bottom of the visual viewport as a sheet
    // (vars from useVisualViewportVars), so an on-screen keyboard lifts the
    // whole sheet instead of covering its lower fields/buttons.
    MuiDialog: {
      styleOverrides: {
        root: ({ theme }) => ({
          [theme.breakpoints.down("sm")]: {
            top: "var(--vv-top, 0px)",
            bottom: "auto",
            height: "var(--vv-height, 100%)",
          },
        }),
        container: ({ theme }) => ({
          [theme.breakpoints.down("sm")]: { alignItems: "flex-end" },
        }),
        paper: ({ theme }) => ({
          [theme.breakpoints.down("sm")]: {
            margin: 0,
            width: "100%",
            maxWidth: "100%",
            maxHeight: "calc(100% - 16px)",
            borderRadius: "18px 18px 0 0",
            paddingBottom: "env(safe-area-inset-bottom)",
          },
        }),
      },
    },
    // AppBar is Paper-based and otherwise inherits theme.shape.borderRadius
    // (12px, meant for cards) on all four corners — visible as rounded
    // notches at the top edge since AppHeader sits flush against the screen.
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
  },
});

// Resolved-mode literal primary accent — for contexts that can't consume
// `sx={{ color: 'primary.main' }}`-style theme-aware styling, e.g.
// @mui/x-charts' `series[].color`, which needs a plain CSS color string, not
// something resolved through MUI's own component styling pipeline. A raw
// `var(--mui-palette-primary-main)` string doesn't work here — this theme
// isn't in CSS-variables mode (no `cssVariables: true` above), so that
// variable is never actually defined anywhere in the page, silently making
// anything relying on it (a chart line's stroke, a mark's fill) invisible.
// Same light/dark literal-value shape as `shadows` below, resolved the same
// way via `useColorScheme()`.
export const primaryAccent = {
  light: PRIMARY_LIGHT,
  dark: PRIMARY_DARK,
};

// Two-tier tinted shadow system — see design-system.md "Elevation" section.
// Not MUI defaults (generic gray); apply per-context rather than as a blanket override.
export const shadows = {
  light: {
    sh1: "0 1px 2px rgba(92,106,82,.06)",
    sh2: "0 6px 16px rgba(92,106,82,.12)",
    floating: "0 6px 14px rgba(93,110,1,.35)",
  },
  dark: {
    sh1: "0 1px 2px rgba(0,0,0,.3)",
    sh2: "0 6px 16px rgba(0,0,0,.4)",
    floating: "0 6px 14px rgba(0,0,0,.5)",
  },
};
