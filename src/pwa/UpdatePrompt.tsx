import { useEffect, useRef } from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useNotification } from "../components/NotificationProvider";
import { usePwaUpdateStore } from "../store/usePwaUpdateStore";

// An installed PWA can sit open in a single tab/window for days without
// navigating, so the browser's own "check the SW for updates on navigation"
// heuristic may never fire on its own — poll explicitly so a deploy is
// noticed while the app stays open. See docs/pending-deviations.md ("PWA
// update prompt").
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function UpdatePrompt() {
  const { notify, dismiss } = useNotification();
  // The queued notification's own key, once shown — so this can `dismiss`
  // it if `needRefresh` goes back to false without the user having clicked
  // either of its own action buttons (see the effect below). null both
  // before it's ever been shown and after it's been dismissed.
  const shownKey = useRef<number | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      usePwaUpdateStore.getState().setRegistration(registration ?? null);
      if (!registration) return;
      setInterval(() => {
        // Best-effort — a failed check (offline, a transient network error)
        // just means the next interval tries again.
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  // Mirrored into the store so Profile.tsx's manual "Check for updates"
  // button can tell, right after its own check resolves, whether an update
  // was already found (and so skip its own "up to date" feedback) without
  // holding a second useRegisterSW registration of its own.
  //
  // Also queues/dismisses this prompt's own notification, previously a
  // <Snackbar open={needRefresh}> bound directly to this same value — now
  // routed through the shared NotificationProvider (docs/pending-deviations.md,
  // "Issue #56", deviation 4), persistent (autoHideDuration: null, unlike
  // every other migrated call site's default 3s) since an available update
  // should stay visible until the user acts on it, not disappear unseen.
  useEffect(() => {
    usePwaUpdateStore.getState().setNeedRefresh(needRefresh);
    if (needRefresh && shownKey.current === null) {
      shownKey.current = notify({
        message: "A new version of Forklore is available",
        autoHideDuration: null,
        action: (
          <>
            <Button
              color="primary"
              size="small"
              onClick={() => updateServiceWorker(true)}
            >
              Reload
            </Button>
            <IconButton
              size="small"
              aria-label="Dismiss"
              color="inherit"
              onClick={() => setNeedRefresh(false)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        ),
      });
    } else if (!needRefresh && shownKey.current !== null) {
      dismiss(shownKey.current);
      shownKey.current = null;
    }
  }, [needRefresh, notify, dismiss, updateServiceWorker, setNeedRefresh]);

  return null;
}
