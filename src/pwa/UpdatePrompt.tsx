import { useEffect } from 'react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import CloseIcon from '@mui/icons-material/Close';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { usePwaUpdateStore } from '../store/usePwaUpdateStore';

// An installed PWA can sit open in a single tab/window for days without
// navigating, so the browser's own "check the SW for updates on navigation"
// heuristic may never fire on its own — poll explicitly so a deploy is
// noticed while the app stays open. See docs/pending-deviations.md ("PWA
// update prompt").
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function UpdatePrompt() {
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
  useEffect(() => {
    usePwaUpdateStore.getState().setNeedRefresh(needRefresh);
  }, [needRefresh]);

  return (
    <Snackbar
      open={needRefresh}
      message="A new version of Forklore is available"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      action={
        <>
          <Button color="primary" size="small" onClick={() => updateServiceWorker(true)}>
            Reload
          </Button>
          <IconButton size="small" aria-label="Dismiss" color="inherit" onClick={() => setNeedRefresh(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </>
      }
    />
  );
}
