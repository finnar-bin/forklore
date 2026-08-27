import { create } from "zustand";

// Shared between UpdatePrompt.tsx (owns the single service worker
// registration via useRegisterSW, mirrors its registration/needRefresh
// state here) and Profile.tsx's manual "Check for updates" button — see
// frontend-architecture.md "Zustand stores". A manual check reuses this
// same registration rather than calling useRegisterSW a second time, which
// would spin up a second Workbox instance with its own listeners and risk
// two separate reload prompts firing for the same update.
interface PwaUpdateState {
  registration: ServiceWorkerRegistration | null;
  checking: boolean;
  needRefresh: boolean;
  setRegistration: (registration: ServiceWorkerRegistration | null) => void;
  setChecking: (checking: boolean) => void;
  setNeedRefresh: (needRefresh: boolean) => void;
}

export const usePwaUpdateStore = create<PwaUpdateState>((set) => ({
  registration: null,
  checking: false,
  needRefresh: false,
  setRegistration: (registration) => set({ registration }),
  setChecking: (checking) => set({ checking }),
  setNeedRefresh: (needRefresh) => set({ needRefresh }),
}));

// No-op (rather than throwing) if the registration hasn't landed yet — e.g.
// service workers are unsupported, or UpdatePrompt hasn't finished
// registering. `registration.update()` resolving doesn't itself distinguish
// "no update found" from "update found but still installing" (installing a
// new version means re-downloading/precaching every asset, which can take
// longer than this call takes to resolve) — callers should treat a still-false
// `needRefresh` right after this resolves as "no update yet", not a hard
// guarantee, since a slow install can still complete moments later.
export async function checkForPwaUpdate(): Promise<void> {
  const { registration, setChecking } = usePwaUpdateStore.getState();
  if (!registration) return;
  setChecking(true);
  try {
    await registration.update();
  } finally {
    setChecking(false);
  }
}
