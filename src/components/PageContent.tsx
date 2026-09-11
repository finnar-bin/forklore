import Stack, { type StackProps } from "@mui/material/Stack";

// Responsive max-width for a screen's primary content column. Every
// feature screen under AnimatedAppShell used to hardcode its own
// `maxWidth: 480, mx: "auto"` on its root Box/Stack with no desktop
// breakpoint, which read as a stretched mobile page once NavRail.tsx
// (issue #62) gave the app real width to work with at >=900px. 480px is
// unchanged below that breakpoint; at >=900px it widens to 760px — chosen
// by rendering RecipeDetail/PantryList/Profile at 1280px (this repo's own
// e2e default viewport) and a few widths around it, landing in the
// 720-840px range that still reads as a focused single column (forms,
// card lists, detail pages) rather than full-bleed text. See
// docs/pending-deviations.md ("Desktop page max-width (issue #63)").
//
// Centers within the *remaining* content area next to NavRail, not the
// raw viewport: AnimatedAppShell.tsx already offsets that area with
// `pl: useNavRailWidth()` at >=900px (NavRail's own collapsed/expanded
// width — see docs/pending-deviations.md, "Collapsible desktop nav
// rail"), so this component's own `mx: "auto"` resolves against what's
// left of the viewport after that padding, same as every other screen
// already rendered inside it.
export const PAGE_CONTENT_MAX_WIDTH = { xs: 480, md: 760 };

// Shared root content wrapper, replacing each screen's own near-duplicate
// `<Stack sx={{ p: 2, maxWidth: 480, mx: "auto", ... }}>` (or a bare `Box`
// for the single-child loading/error case — Stack with no `spacing` renders
// identically for a lone child). Renders a Stack so callers that need
// `spacing` still get it; ones that don't simply omit the prop. `sx` is
// merged over the responsive default (array form, so a caller-supplied
// array or function `sx` still composes correctly) rather than replacing
// it, so callers keep passing their own padding/pb/etc. as before.
export function PageContent({ sx, ...props }: StackProps) {
  return (
    <Stack
      // Not used for anything role/label-based (this repo's e2e suite
      // otherwise queries by role/label/text throughout) — a max-width is a
      // pure layout property with no accessible-name equivalent, so
      // e2e/specs/page-content-width.spec.ts (issue #63) reads this
      // attribute directly to get a stable bounding box for the one
      // screen it measures. A caller passing its own data-testid still
      // wins via {...props} below.
      data-testid="page-content"
      sx={[
        { maxWidth: PAGE_CONTENT_MAX_WIDTH, mx: "auto" },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
    />
  );
}
