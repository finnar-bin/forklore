import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Box from "@mui/material/Box";

// Sectioned counterpart to VirtualizedCardList.tsx (see that file's header
// comment for the window-scroll/scrollMargin rationale, which applies here
// unchanged) — for lists that interleave a header row (a meal-type or
// calendar-day label) between groups of cards, like DailyLog.tsx and
// AllTimeLog.tsx's log entry lists. VirtualizedCardList only takes a flat
// `items: T[]` with one renderItem per index, which can't represent that
// interleaving, so this flattens `sections` into one row list mixing header
// and item rows and virtualizes that instead — only near-viewport rows,
// headers included, are ever mounted.
export interface VirtualizedSection<T> {
  key: string;
  header: ReactNode;
  items: T[];
}

export function VirtualizedSectionedCardList<T>({
  sections,
  estimateSize,
  headerEstimateSize = 28,
  gap,
  extraSectionGap = 0,
  getItemKey,
  renderItem,
  hasMore = false,
  onEndReached,
}: {
  sections: VirtualizedSection<T>[];
  // Rough starting height (px) for a not-yet-measured card — see
  // VirtualizedCardList's identical param.
  estimateSize: number;
  // Same, for a not-yet-measured section header row.
  headerEstimateSize?: number;
  // Space (px) between rows generally — mirrors the MUI Stack `spacing` a
  // section's own header+items used to share (see DailyLog.tsx, whose
  // meal-type sections sat in one uniformly-spaced Stack).
  gap: number;
  // Extra px added above every section header but the first, on top of
  // `gap` — lets a caller reproduce two different Stack `spacing` values (an
  // outer one between sections, an inner one within a section) that a
  // single uniform `gap` can't express alone. 0 (default) suits a caller
  // whose sections were uniformly spaced to begin with (DailyLog.tsx);
  // AllTimeLog.tsx's outer/inner spacing split needs a nonzero value.
  extraSectionGap?: number;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  hasMore?: boolean;
  onEndReached?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // See VirtualizedCardList's identical scrollMargin effect for why this is
  // measured via getBoundingClientRect rather than offsetTop, and
  // re-measured on the parent's resize, not just on mount.
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
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

  type Row =
    | {
        type: "header";
        key: string;
        sectionIndex: number;
        content: ReactNode;
      }
    | { type: "item"; key: string; item: T };

  const rows = useMemo(() => {
    const flat: Row[] = [];
    sections.forEach((section, sectionIndex) => {
      flat.push({
        type: "header",
        key: `section:${section.key}`,
        sectionIndex,
        content: section.header,
      });
      for (const item of section.items) {
        flat.push({ type: "item", key: getItemKey(item), item });
      }
    });
    return flat;
  }, [sections, getItemKey]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (index) =>
      rows[index].type === "header" ? headerEstimateSize : estimateSize,
    overscan: 6,
    gap,
    scrollMargin,
    // Same identity-alignment purpose as VirtualizedCardList's — keeps a
    // cached measured height from being misapplied to a different row that
    // now occupies the same index after a live-query resort.
    getItemKey: (index) => rows[index].key,
  });

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
        const row = rows[virtualItem.index];
        return (
          <div
            key={row.key}
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
            {row.type === "header" ? (
              <Box
                sx={{
                  pt: row.sectionIndex > 0 ? `${extraSectionGap}px` : 0,
                }}
              >
                {row.content}
              </Box>
            ) : (
              renderItem(row.item)
            )}
          </div>
        );
      })}
    </div>
  );
}
