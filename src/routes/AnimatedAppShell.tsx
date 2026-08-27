import { useState, type ReactNode } from "react";
import { Box } from "@mui/material";
import { useLocation, useOutlet } from "react-router-dom";
import { motion } from "framer-motion";
import { BottomNav } from "../components/BottomNav";
import {
  classifyTransition,
  getBottomTab,
  type TransitionVariant,
} from "./navigationTransition";

// Layout for every screen behind the bottom-tab structure (Pantry, Recipes,
// Log, Progress, and everything reachable from them — detail screens,
// Groups, Sync status). Animates the router outlet per
// frontend-architecture.md's "Navigation animation" section, and renders
// BottomNav as a sibling of the animated content (not a descendant of it) —
// see FloatingPortal for why that separation matters for anything using
// position: fixed here.
//
// Deliberately NOT AnimatePresence. An AnimatePresence child's `exit` prop
// is fixed at whatever it was on that child's OWN last render — passing a
// fresh `custom` to AnimatePresence itself is documented to update it for an
// already-unmounting child, but empirically (see docs/pending-deviations.md,
// Ticket 16) that update doesn't land in time: the outgoing screen exits
// with the direction it *entered* with, not the one removing it, so a
// pop right after a push exited in the wrong direction (or not at all,
// visibly) and the incoming screen played a stray extra animation cycle
// correcting itself mid-flight — the reported "janky" feel. Tracking the
// outgoing screen's content and direction ourselves sidesteps the whole
// class of bug: both screens' animations are literal per-render values,
// never a variant recomputed after the fact.
const TRANSITION = { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };

function enterFrom(direction: TransitionVariant) {
  if (direction === "push") return { x: "100%", opacity: 1 };
  if (direction === "pop") return { x: "-100%", opacity: 1 };
  return { x: 0, opacity: 0 }; // tab-switch: crossfade only, no slide
}

function exitTo(direction: TransitionVariant) {
  if (direction === "push") return { x: "-100%", opacity: 1 };
  if (direction === "pop") return { x: "100%", opacity: 1 };
  return { x: 0, opacity: 0 }; // tab-switch: crossfade only, no slide
}

interface Screen {
  pathname: string;
  node: ReactNode;
  // The direction *this specific transition* moves it — always the same
  // value on both the outgoing and incoming screen of one navigation, so
  // "enters from the right" and "exits to the left" (push) stay a matched
  // pair regardless of what either screen's own previous transition was.
  direction: TransitionVariant;
}

export function AnimatedAppShell() {
  const location = useLocation();
  const outlet = useOutlet();

  const [current, setCurrent] = useState<Screen>({
    pathname: location.pathname,
    node: outlet,
    direction: "tab",
  });
  const [outgoing, setOutgoing] = useState<Screen | null>(null);

  // "Adjusting state when a prop changes" pattern (react.dev): snapshot the
  // screen that's about to leave — its own last-rendered content, tagged
  // with the direction *this* navigation removes it in — synchronously
  // during render, not an effect, so there's no extra committed frame where
  // either screen's props are stale.
  if (location.pathname !== current.pathname) {
    const direction = classifyTransition(current.pathname, location.pathname);
    setOutgoing({ ...current, direction });
    setCurrent({ pathname: location.pathname, node: outlet, direction });
  }

  const activeTab = getBottomTab(location.pathname);
  const overlapping = outgoing !== null;

  return (
    <>
      {/* overflow-x hidden only — a mid-slide screen briefly extends past
          the viewport edge and shouldn't add horizontal scroll. minHeight
          keeps this a real containing block for the two absolutely
          positioned children below during the brief overlap window (they'd
          otherwise collapse it to zero height, since neither contributes to
          a parent's auto height). */}
      <Box
        sx={{ position: "relative", overflowX: "hidden", minHeight: "100vh" }}
      >
        {outgoing && (
          <motion.div
            key={outgoing.pathname}
            initial={false}
            animate={exitTo(outgoing.direction)}
            transition={TRANSITION}
            onAnimationComplete={() =>
              setOutgoing((current) =>
                current?.pathname === outgoing.pathname ? null : current,
              )
            }
            style={{ position: "absolute", inset: 0 }}
          >
            {outgoing.node}
          </motion.div>
        )}
        <motion.div
          key={current.pathname}
          initial={enterFrom(current.direction)}
          animate={{ x: 0, opacity: 1 }}
          transition={TRANSITION}
          style={overlapping ? { position: "absolute", inset: 0 } : undefined}
        >
          {current.node}
        </motion.div>
      </Box>
      {activeTab && <BottomNav />}
    </>
  );
}
