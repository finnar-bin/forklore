import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme, type Breakpoint } from "@mui/material/styles";

// Windows-scroll virtualization for the card lists in RecipeList.tsx,
// PantryList.tsx and CommunityPantryList.tsx (Ticket 44, "Performance
// updates" — see docs/pending-deviations.md, "List virtualization +
// pagination"). Those screens are full-page routes that scroll with the
// document itself (FAB/BottomNav rely on that — see RecipeList.tsx's FAB
// positioning comment), not an inner `overflow: auto` panel, so this virtualizes
// against `window` (`useWindowVirtualizer`) rather than wrapping the list in
// its own scroll container, which would fight that layout. Only near-viewport
// cards are ever mounted, regardless of how many `items` there are.
//
// `onEndReached`/`hasMore` are optional — passed by the three callers above to
// drive their own incremental-load ("infinite scroll") state as the window
// scrolls near the bottom of whatever page of `items` is currently loaded;
// omit them for a list that's already fully loaded.
//
// A responsive column count, mirroring an MUI `sx` breakpoint object's own
// mobile-first cascade: the largest breakpoint at or below the current
// viewport that specifies a value wins (see `useResolvedColumns` below).
type ResponsiveColumns = Partial<Record<Breakpoint, number>>;

// Resolves `columns` (see VirtualizedCardList's own prop comment) to a plain
// number for the current viewport. Always calls the same MUI `useMediaQuery`
// hooks regardless of whether `columns` is a plain number or a responsive
// object — a component-level hook can't itself branch on a prop before
// deciding whether to call another hook.
function useResolvedColumns(columns: number | ResponsiveColumns): number {
  const theme = useTheme();
  const upSm = useMediaQuery(theme.breakpoints.up("sm"));
  const upMd = useMediaQuery(theme.breakpoints.up("md"));
  const upLg = useMediaQuery(theme.breakpoints.up("lg"));
  const upXl = useMediaQuery(theme.breakpoints.up("xl"));
  if (typeof columns === "number") return columns;
  let resolved = columns.xs ?? 1;
  if (upSm && columns.sm !== undefined) resolved = columns.sm;
  if (upMd && columns.md !== undefined) resolved = columns.md;
  if (upLg && columns.lg !== undefined) resolved = columns.lg;
  if (upXl && columns.xl !== undefined) resolved = columns.xl;
  return resolved;
}

export function VirtualizedCardList<T>({
  items,
  estimateSize,
  gap,
  getItemKey,
  renderItem,
  hasMore = false,
  onEndReached,
  columns = 1,
}: {
  items: T[];
  // Rough starting height (px) for a not-yet-measured card — corrected per
  // item once rendered via the virtualizer's own ResizeObserver
  // (`measureElement` below), so this only has to be close enough to keep
  // the initial scrollbar/jump reasonable. With `columns` > 1 this estimates
  // one *row's* height (i.e. one card's height, since same-row cards share a
  // height), not the whole grid's.
  estimateSize: number;
  // Space (px) between cards — mirrors the MUI Stack `spacing` prop each
  // caller used before switching to this component (theme spacing unit is
  // 8px, so e.g. `spacing={1.5}` is `gap={12}`). Doubles as the column gap
  // when `columns` > 1, so rows and columns read as evenly spaced.
  gap: number;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  hasMore?: boolean;
  onEndReached?: () => void;
  // How many cards to lay out per row — a plain number, or a responsive
  // object cascading like an MUI `sx` breakpoint object (issue #64, "Desktop
  // UI: multi-column grid for virtualized card lists"). Defaults to 1: a
  // caller that never passes this gets the exact single-column DOM/behavior
  // this component always had — see the `resolvedColumns <= 1` branches
  // below, which are untouched by the grid path added for `columns` > 1.
  columns?: number | ResponsiveColumns;
}) {
  const resolvedColumns = useResolvedColumns(columns);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // The list never renders as the very first thing on the page (a "Browse
  // community pantry" button, the community opt-in switch, an error alert,
  // or a "Add the first X" empty-state message can all sit above it — see
  // the three callers) — scrollMargin needs this container's actual offset
  // from the top of the document, not 0, or item positions would be off by
  // however much sits above it. Re-measured on mount *and* whenever this
  // container's parent resizes — not mount-only: PantryList's
  // community-toggle error Alert can appear/disappear above an
  // already-mounted, non-empty list (the switch fails after the list is
  // showing), changing the parent Stack's intrinsic height and thus this
  // container's offset without anything about `items` itself changing. The
  // parent (not the container or `window`) is what's observed, since it's
  // sized by everything around the list, siblings above included.
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      // `offsetTop` is relative to the nearest *positioned* ancestor (CSSOM
      // spec), not the document — on every current caller that ancestor is
      // the screen's own root `position: relative` Box, which sits below
      // AppHeader's sticky AppBar as a sibling, so `offsetTop` alone would
      // silently exclude that AppBar's height from the offset. Deriving it
      // from `getBoundingClientRect().top` (viewport-relative) plus the
      // current scroll position instead gives this container's actual
      // offset from the top of the document regardless of any positioned
      // ancestor in between.
      const offset = container.getBoundingClientRect().top + window.scrollY;
      setScrollMargin((prev) => (prev === offset ? prev : offset));
    };
    measure();
    const parent = container.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  // Grouping `items` into rows of `resolvedColumns` lets the virtualizer
  // operate on rows rather than individual cards once multi-column is
  // active — it never sees a "column", only a row it measures as a whole
  // (so row height naturally comes out as the tallest card in it, since
  // that's the row `<div>`'s own rendered height). At the default of 1
  // column this is skipped entirely (`rows` stays null) so the single-item
  // branches below run byte-for-byte as they did before `columns` existed.
  const rows = useMemo(() => {
    if (resolvedColumns <= 1) return null;
    const grouped: T[][] = [];
    for (let i = 0; i < items.length; i += resolvedColumns) {
      grouped.push(items.slice(i, i + resolvedColumns));
    }
    return grouped;
  }, [items, resolvedColumns]);

  const virtualizer = useWindowVirtualizer({
    count: rows ? rows.length : items.length,
    estimateSize: () => estimateSize,
    overscan: 6,
    gap,
    scrollMargin,
    // Aligns the library's own item-identity tracking (itemSizeCache etc.)
    // with the React-level `key` below, so a cached measured height can't
    // get misapplied to a different item/row that now occupies the same
    // index after a live-query resort/delete (see
    // docs/pending-deviations.md, "List virtualization + pagination"). A
    // row's key is its first card's key — same caveat, applied to whichever
    // card now leads that row.
    getItemKey: (index) =>
      rows ? getItemKey(rows[index][0]) : getItemKey(items[index]),
  });

  // Fires again whenever the visible range's end index changes (i.e. the
  // user scrolled), not on every render — `virtualizer` itself is a stable
  // instance across renders.
  const endIndex = virtualizer.range?.endIndex;
  useEffect(() => {
    if (!hasMore || !onEndReached) return;
    if (virtualizer.isAtEnd(600)) onEndReached();
  }, [virtualizer, endIndex, hasMore, onEndReached]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: virtualizer.getTotalSize(),
      }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => {
        if (rows) {
          const row = rows[virtualItem.index];
          return (
            <div
              key={getItemKey(row[0])}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start - scrollMargin}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${resolvedColumns}, minmax(0, 1fr))`,
                // Column gap only — the virtualizer's own `gap` above
                // already spaces row to row, and this container only ever
                // lays out one grid row.
                columnGap: gap,
                // Top-aligned, not stretched: a shorter card in the same
                // row should render at its own natural height, not get
                // stretched to match the tallest one (which would spread
                // its noWrap text and metric row apart with the same blank
                // vertical space design-system.md's card pattern normally
                // never has).
                alignItems: "start",
              }}
            >
              {row.map((item) => (
                <div key={getItemKey(item)}>{renderItem(item)}</div>
              ))}
            </div>
          );
        }
        const item = items[virtualItem.index];
        return (
          <div
            key={getItemKey(item)}
            ref={virtualizer.measureElement}
            data-index={virtualItem.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualItem.start - scrollMargin}px)`,
            }}
          >
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
}
