# Design system

Living document. MUI v6, themed with the Everforest color palette. Design philosophy: clean and easy to use, but not devoid of data — summary visible at a glance, detail one tap away. Layered depth via soft shadows, not flat.

## Reference mockups

Static reference screens live in `/docs/mocks/` — `pantry-light.png`, `pantry-dark.png`, `recipe-detail-light.png`, `recipe-detail-dark.png` (plus their `.html` sources, useful if a value needs tweaking later). These are not exhaustive screen-by-screen specs — they exist to fix the visual language (card shape, shadow depth, spacing, icon treatment, color usage) in one concrete place so it can be extrapolated consistently to every other screen, rather than re-decided per screen. Icons shown are placeholder inline SVGs standing in for whatever icon set gets used in the real build (e.g. MUI's icon set) — the icon choices themselves aren't prescriptive, the sizing/color/placement pattern is.

---

## Phase 1

### Why MUI needs deliberate theming

Left at defaults, MUI is very recognizable at a glance. Four defaults specifically need overriding, once, at the start of the project — not retrofitted per-screen later:

1. **Font** — swap Roboto for something else entirely (e.g. Inter).
2. **Primary color** — replace default MUI blue with the Everforest palette (see below).
3. **Ripple effect** — disable on buttons (`disableRipple`), it's a very recognizable MUI tell.
4. **Elevation shadows** — MUI's default Paper shadows are generic gray; replace with the tinted, layered shadow system below.

### Color palette — Everforest

Light and dark variants defined via MUI's `colorSchemes` API, which handles CSS variables and mode switching (including a manual override, persisted to localStorage automatically via `CssVarsProvider`'s default `modeStorageKey`).

```ts
const theme = createTheme({
  colorSchemes: {
    light: {
      palette: {
        background: { default: "#F3EAD3", paper: "#FDF6E3" },
        primary: { main: "#8DA101" },
        secondary: { main: "#DFA000" },
        error: { main: "#F85552" },
        text: { primary: "#4A555A", secondary: "#8A9691" },
      },
    },
    dark: {
      palette: {
        background: { default: "#232A2E", paper: "#2D373C" },
        primary: { main: "#A7C080" },
        secondary: { main: "#DBBC7F" },
        error: { main: "#E67E80" },
        text: { primary: "#D3C6AA", secondary: "#889086" },
      },
    },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: '"Inter", sans-serif' },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 500 },
      },
    },
  },
});
```

```tsx
const { mode, setMode } = useColorScheme();
<IconButton onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
  {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
</IconButton>;
```

### Elevation — layered shadows, not flat

Two-tier shadow system. Do not rely on MUI's default Paper elevation shadows (generic gray) — use tinted, soft shadows matching the palette instead.

| Token                                       | Light mode                       | Dark mode                   | Use                                                                                                           |
| ------------------------------------------- | -------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `sh1` (subtle)                              | `0 1px 2px rgba(92,106,82,.06)`  | `0 1px 2px rgba(0,0,0,.3)`  | Sticky headers, small chips, separating content from a background of the same general hue                     |
| `sh2` (raised)                              | `0 6px 16px rgba(92,106,82,.12)` | `0 6px 16px rgba(0,0,0,.4)` | Cards, list items — the primary "this is a distinct surface" signal                                           |
| Floating elements (FAB, primary CTA button) | `0 6px 14px rgba(93,110,1,.35)`  | `0 6px 14px rgba(0,0,0,.5)` | Strongest shadow — reserved for elements that are genuinely floating over content, not just separated from it |

```ts
MuiPaper: {
  styleOverrides: {
    root: {
      backgroundImage: 'none',
      // apply sh1/sh2 per-context rather than a single blanket override
    },
  },
},
```

### Component patterns

**Card / list item pattern** (used across Pantry, Recipes, Log — the "summary visible, detail one tap away" philosophy in concrete form):

- Left: 52×52px rounded (12px radius) thumbnail — a real photo if `photo_url` is set, otherwise a generic placeholder icon (not a per-category icon; category-specific iconography was tried and rejected in favor of always showing real photo content or an honest "no photo" state)
- Center: title (14px/500) + subtitle (12px, muted) — name plus a secondary detail (quantity+who added it, or servings+group)
- Right: primary metric (14px/500, accent color) + secondary metric (11px, muted) — e.g. total kcal + per-unit rate
- Card background uses the `sh2` shadow, 14px border radius, no visible border (shadow alone provides separation)

Tapping the card expands to full detail (photo enlarged, edit history, full nutrition breakdown) rather than cramming everything into the list view.

**Context switcher chip** — pill-shaped, sits below the header on Pantry/Recipes/Log screens only (Progress ignores it — BMI/weight data has no group dimension, see routes.md). Shows current context name with a dropdown chevron; tapping opens the group/personal picker.

**Bottom navigation** — 4 tabs: Pantry, Recipes, Log, Progress. Active tab uses the primary accent color for both icon and label; inactive tabs use muted text color. No filled/pill background on the active tab — text/icon color change alone is sufficient, keeping with the overall restraint in the visual language.

**Profile/account access** — not a 5th tab. Lives behind a persistent avatar icon in the header (top-right), visible across all four main tabs. Reflects that account-level actions (edit profile, logout, theme toggle) are occasional, not primary navigation.

**Floating action button (FAB)** — used for primary "add" actions (e.g. add ingredient from Pantry). Positioning note: must be anchored relative to the screen's root container, not a local wrapper div — a FAB wrapped in its own `position: relative` container with no other content will collapse that container to zero height, causing the `bottom` offset to be calculated incorrectly and the button to appear misplaced.

### Missing photo state

Generic placeholder icon (a simple camera/photo icon on a neutral gradient tile), used identically whether an ingredient, recipe, or user avatar has no photo. Not a per-category icon (e.g. no distinct "meat" vs "vegetable" iconography) — the goal is to represent "no photo yet," not to categorize the item.

### Content/copy conventions

- Sentence case everywhere — buttons, headings, labels. Never Title Case or ALL CAPS.
- Buttons are verb-first, 1–3 words: "Log this recipe", "Create group" — not "OK" or "Submit".
- Errors state what happened, then what to do, in one sentence, no "Error:" prefix.
- "Your pantry", "your recipes" — never "my pantry" in system copy (system speaks to the user, not as the user).
