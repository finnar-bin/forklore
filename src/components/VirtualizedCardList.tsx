import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

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
export function VirtualizedCardList<T>({
  items,
  estimateSize,
  gap,
  getItemKey,
  renderItem,
  hasMore = false,
  onEndReached,
}: {
  items: T[];
  // Rough starting height (px) for a not-yet-measured card — corrected per
  // item once rendered via the virtualizer's own ResizeObserver
  // (`measureElement` below), so this only has to be close enough to keep
  // the initial scrollbar/jump reasonable.
  estimateSize: number;
  // Space (px) between cards — mirrors the MUI Stack `spacing` prop each
  // caller used before switching to this component (theme spacing unit is
  // 8px, so e.g. `spacing={1.5}` is `gap={12}`).
  gap: number;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  hasMore?: boolean;
  onEndReached?: () => void;
}) {
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

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan: 6,
    gap,
    scrollMargin,
    // Aligns the library's own item-identity tracking (itemSizeCache etc.)
    // with the React-level `key` below, so a cached measured height can't
    // get misapplied to a different item that now occupies the same index
    // after a live-query resort/delete (see docs/pending-deviations.md,
    // "List virtualization + pagination").
    getItemKey: (index) => getItemKey(items[index]),
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
