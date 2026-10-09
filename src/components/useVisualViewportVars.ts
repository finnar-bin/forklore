import { useEffect } from "react";

// Mirrors the visual viewport (what's left above an on-screen keyboard) into
// CSS vars so the mobile dialog sheet in theme.ts can dock to it.
export function useVisualViewportVars() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;

    const update = () => {
      root.style.setProperty("--vv-top", `${viewport.offsetTop}px`);
      root.style.setProperty("--vv-height", `${viewport.height}px`);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--vv-top");
      root.style.removeProperty("--vv-height");
    };
  }, []);
}
