import { createTheme } from '@mui/material/styles';

// Everforest palette — see docs/mocks/design-system.md
export const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        background: { default: '#F3EAD3', paper: '#FDF6E3' },
        primary: { main: '#8DA101' },
        secondary: { main: '#DFA000' },
        error: { main: '#F85552' },
        text: { primary: '#4A555A', secondary: '#8A9691' },
      },
    },
    dark: {
      palette: {
        background: { default: '#232A2E', paper: '#2D373C' },
        primary: { main: '#A7C080' },
        secondary: { main: '#DBBC7F' },
        error: { main: '#E67E80' },
        text: { primary: '#D3C6AA', secondary: '#889086' },
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: '"Inter", sans-serif' },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
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

// Two-tier tinted shadow system — see design-system.md "Elevation" section.
// Not MUI defaults (generic gray); apply per-context rather than as a blanket override.
export const shadows = {
  light: {
    sh1: '0 1px 2px rgba(92,106,82,.06)',
    sh2: '0 6px 16px rgba(92,106,82,.12)',
    floating: '0 6px 14px rgba(93,110,1,.35)',
  },
  dark: {
    sh1: '0 1px 2px rgba(0,0,0,.3)',
    sh2: '0 6px 16px rgba(0,0,0,.4)',
    floating: '0 6px 14px rgba(0,0,0,.5)',
  },
};
