import { useEffect } from "react";

// Keeps --visual-viewport-height in sync with window.visualViewport, so
// MuiDialog's root (position: fixed, height: 100% against the *layout*
// viewport) can be pinned to the *visible* viewport height instead via
// theme.ts's MuiDialog override. Without this, an on-screen mobile keyboard
// shrinks the visible area but not the layout viewport, so a Dialog's
// flex-centered content stays centered against the old (taller) height and
// a lower input ends up hidden behind the keyboard. Falls back to the
// override's own `100%` default in browsers without window.visualViewport
// (or where index.html's interactive-widget=resizes-content already handles
// this natively).
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
