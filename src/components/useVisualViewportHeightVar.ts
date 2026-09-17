import { useEffect } from "react";

// Tracks the visible (not layout) viewport height for theme.ts's MuiDialog
// override, so a mobile keyboard doesn't cover a dialog's lower fields.
export function useVisualViewportHeightVar() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateHeightVar = () => {
      document.documentElement.style.setProperty(
        "--visual-viewport-height",
        `${viewport.height}px`,
      );
    };

    updateHeightVar();
    viewport.addEventListener("resize", updateHeightVar);
    viewport.addEventListener("scroll", updateHeightVar);
    return () => {
      viewport.removeEventListener("resize", updateHeightVar);
      viewport.removeEventListener("scroll", updateHeightVar);
    };
  }, []);
}
