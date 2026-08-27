import { createPortal } from "react-dom";
import type { ReactNode } from "react";

// Renders children into #floating-root (declared in index.html), a sibling
// of #root — not a descendant of it. A FAB using position: fixed still
// resolves against whatever transformed ancestor is closest to it in the DOM
// (CSS: any element with a transform becomes the containing block for its
// fixed-position descendants), and AnimatedAppShell's motion.div applies
// exactly that kind of transform to animate screen transitions. Portalling
// out from under it is what keeps every page's FAB anchored to the actual
// viewport instead of drifting with — or getting clipped by — the animated
// screen content. See design-system.md's FAB positioning note and
// docs/pending-deviations.md (Ticket 16).
export function FloatingPortal({ children }: { children: ReactNode }) {
  const target = document.getElementById("floating-root");
  if (!target) return null;
  return createPortal(children, target);
}
