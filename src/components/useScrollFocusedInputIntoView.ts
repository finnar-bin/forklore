import { useEffect } from "react";

// MuiDialog is position: fixed against the layout viewport, which a mobile
// keyboard doesn't shrink, so a covered field can't be brought into view by
// scrolling alone (nothing overflows). Nudges .MuiDialog-container up by
// just enough to clear the keyboard instead.
const CONTAINER_SELECTOR = ".MuiDialog-container";
const BOTTOM_MARGIN_PX = 16;

export function useScrollFocusedInputIntoView() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const reposition = () => {
      const active = document.activeElement;
      if (!active) return;
      const container = active.closest(CONTAINER_SELECTOR);
      if (!(container instanceof HTMLElement)) return;

      container.style.transition = "transform 150ms ease-out";
      container.style.transform = "";
      const overlap =
        active.getBoundingClientRect().bottom +
        BOTTOM_MARGIN_PX -
        viewport.height;
      if (overlap > 0) {
        container.style.transform = `translateY(-${Math.round(overlap)}px)`;
      }
    };

    const clearOnBlur = () => {
      requestAnimationFrame(() => {
        const stillFocused =
          document.activeElement?.closest(CONTAINER_SELECTOR);
        if (!stillFocused) {
          document
            .querySelectorAll<HTMLElement>(CONTAINER_SELECTOR)
            .forEach((el) => {
              el.style.transform = "";
            });
        }
      });
    };

    viewport.addEventListener("resize", reposition);
    document.addEventListener("focusin", reposition);
    document.addEventListener("focusout", clearOnBlur);
    return () => {
      viewport.removeEventListener("resize", reposition);
      document.removeEventListener("focusin", reposition);
      document.removeEventListener("focusout", clearOnBlur);
    };
  }, []);
}
