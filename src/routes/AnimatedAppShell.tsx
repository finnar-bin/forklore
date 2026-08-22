import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomNav } from '../components/BottomNav';
import { classifyTransition, getBottomTab, type TransitionVariant } from './navigationTransition';

// Layout for every screen behind the bottom-tab structure (Pantry, Recipes,
// Log, Progress, and everything reachable from them — detail screens,
// Groups, Sync status). Wraps the router outlet in AnimatePresence per
// frontend-architecture.md's "Navigation animation" section, and renders
// BottomNav as a sibling of the animated content (not a descendant of it) —
// see FloatingPortal for why that separation matters for anything using
// position: fixed here.
const SLIDE_DISTANCE = 48;

// A function-variant so AnimatePresence can recompute the *exiting* screen's
// animation using the transition that's actually removing it, via its
// `custom` prop, instead of the transition that originally brought that
// screen in. (frontend-architecture.md's sample keys a single `isPush`
// boolean directly into `initial`/`exit`, which only reflects the direction
// at mount time — insufficient once push and pop need visually distinct exit
// directions per the ticket 16 acceptance criteria. See
// docs/pending-deviations.md, Ticket 16.)
const pageVariants = {
  initial: (direction: TransitionVariant) => ({
    x: direction === 'push' ? SLIDE_DISTANCE : direction === 'pop' ? -SLIDE_DISTANCE : 0,
    opacity: direction === 'tab' ? 0 : 1,
  }),
  animate: { x: 0, opacity: 1 },
  exit: (direction: TransitionVariant) => ({
    x: direction === 'push' ? -SLIDE_DISTANCE : direction === 'pop' ? SLIDE_DISTANCE : 0,
    opacity: direction === 'tab' ? 0 : 1,
  }),
};

export function AnimatedAppShell() {
  const location = useLocation();

  // "Adjusting state when a prop changes" pattern (react.dev) — tracks the
  // previous pathname alongside the current one, both updated synchronously
  // during render (not an effect) so this same render already has the right
  // "previous vs. current" pair for classifyTransition, with no extra
  // committed frame in between.
  const [pathname, setPathname] = useState(location.pathname);
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (location.pathname !== pathname) {
    setPrevPathname(pathname);
    setPathname(location.pathname);
  }

  const variant = classifyTransition(prevPathname, pathname);
  const activeTab = getBottomTab(location.pathname);

  return (
    <>
      <AnimatePresence mode="wait" initial={false} custom={variant}>
        <motion.div
          key={location.pathname}
          custom={variant}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
      {activeTab && <BottomNav />}
    </>
  );
}
