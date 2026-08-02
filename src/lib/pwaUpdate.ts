import { registerSW } from "virtual:pwa-register";

type Listener = (state: PwaUpdateState) => void;

export interface PwaUpdateState {
  needRefresh: boolean;
  offlineReady: boolean;
  updating: boolean;
  lastCheck: number | null;
}

let state: PwaUpdateState = {
  needRefresh: false,
  offlineReady: false,
  updating: false,
  lastCheck: null,
};

const listeners = new Set<Listener>();
let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

function emit(patch: Partial<PwaUpdateState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function subscribePwaUpdate(l: Listener) {
  listeners.add(l);
  l(state);
  return () => listeners.delete(l);
}

export function getPwaUpdateState() {
  return state;
}

const SW_URL = "/sw.js";
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function isBlockedContext() {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  if (window.top !== window.self) return true;

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;

  return false;
}

async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => (r.active?.scriptURL || r.waiting?.scriptURL || "").endsWith(SW_URL))
        .map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
}

/** Registers the app service worker and wires the update flow. */
export function initPwaUpdates() {
  if (isBlockedContext()) {
    void unregisterAppSW();
    return;
  }

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      emit({ needRefresh: true });
    },
    onOfflineReady() {
      emit({ offlineReady: true });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      emit({ lastCheck: Date.now() });
      setInterval(() => {
        if (navigator.onLine) void registration.update().catch(() => {});
      }, CHECK_INTERVAL_MS);
      window.addEventListener("focus", () => {
        if (navigator.onLine) void registration.update().catch(() => {});
      });
    },
  });
}

/** Manually check the server for a new version. */
export async function checkForPwaUpdate(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
    emit({ lastCheck: Date.now() });
    return !!reg?.waiting;
  } catch {
    return false;
  }
}

/** Applies the pending update and reloads the app. */
export async function applyPwaUpdate() {
  emit({ updating: true });
  try {
    if (updateSW) {
      await updateSW(true);
    } else {
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
}

export function dismissPwaUpdate() {
  emit({ needRefresh: false });
}
