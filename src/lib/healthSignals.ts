// Service Worker health + memory pressure signals (all real browser APIs)

export interface SwHealth {
  supported: boolean;
  registered: boolean;
  scope: string | null;
  scriptUrl: string | null;
  state: string | null;          // installing | waiting | active state
  hasController: boolean;        // page is being controlled
  hasWaiting: boolean;           // update installed, waiting to activate
  hasInstalling: boolean;        // update in progress
  updateViaCache: string | null; // 'imports' | 'all' | 'none'
  stuck: boolean;                // heuristic: waiting > 60s or installing > 60s
  stuckReason: string | null;
  lastUpdatedIso: string | null; // last time we checked/registered
}

const LS_KEY = "sw-last-checked-iso";

export async function getSwHealth(): Promise<SwHealth> {
  const base: SwHealth = {
    supported: "serviceWorker" in navigator,
    registered: false,
    scope: null,
    scriptUrl: null,
    state: null,
    hasController: false,
    hasWaiting: false,
    hasInstalling: false,
    updateViaCache: null,
    stuck: false,
    stuckReason: null,
    lastUpdatedIso: localStorage.getItem(LS_KEY),
  };
  if (!base.supported) return base;

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    base.hasController = !!navigator.serviceWorker.controller;
    if (!reg) return base;

    base.registered = true;
    base.scope = reg.scope;
    base.updateViaCache = (reg as ServiceWorkerRegistration & { updateViaCache?: string }).updateViaCache ?? null;
    const active = reg.active ?? reg.waiting ?? reg.installing;
    base.scriptUrl = active?.scriptURL ?? null;
    base.state = active?.state ?? null;
    base.hasWaiting = !!reg.waiting;
    base.hasInstalling = !!reg.installing;

    // Stuck heuristic — waiting SW that never activates, or installing that never finishes.
    if (reg.waiting && !navigator.serviceWorker.controller) {
      base.stuck = true;
      base.stuckReason = "SW instalado aguardando ativação (sem controller ativo)";
    } else if (reg.installing && (active?.state === "redundant")) {
      base.stuck = true;
      base.stuckReason = "SW anterior redundante enquanto novo ainda instala";
    }
  } catch {
    // ignore
  }
  return base;
}

export async function forceSwUpdate(): Promise<{ ok: boolean; hadWaiting: boolean }> {
  if (!("serviceWorker" in navigator)) return { ok: false, hadWaiting: false };
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { ok: false, hadWaiting: false };
  try {
    await reg.update();
    localStorage.setItem(LS_KEY, new Date().toISOString());
    let hadWaiting = false;
    if (reg.waiting) {
      hadWaiting = true;
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    return { ok: true, hadWaiting };
  } catch {
    return { ok: false, hadWaiting: false };
  }
}

export async function unregisterSw(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  try {
    return await reg.unregister();
  } catch {
    return false;
  }
}

// -------------------- Memory pressure --------------------

export interface MemoryPressure {
  supported: boolean;
  usedBytes: number | null;
  totalBytes: number | null;
  limitBytes: number | null;
  usagePct: number | null;      // used / limit
  level: "ok" | "warn" | "crit" | "unknown";
  wasDiscarded: boolean;        // page was previously discarded by browser
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
}

export function getMemoryPressure(): MemoryPressure {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  };
  const doc = document as Document & { wasDiscarded?: boolean };
  const nav = navigator as Navigator & { deviceMemory?: number };

  const mem = perf.memory;
  if (!mem) {
    return {
      supported: false,
      usedBytes: null, totalBytes: null, limitBytes: null, usagePct: null,
      level: "unknown",
      wasDiscarded: !!doc.wasDiscarded,
      deviceMemoryGb: nav.deviceMemory ?? null,
      hardwareConcurrency: nav.hardwareConcurrency ?? null,
    };
  }

  const pct = mem.jsHeapSizeLimit > 0 ? (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100 : null;
  const level: MemoryPressure["level"] =
    pct == null ? "unknown"
    : pct >= 90 ? "crit"
    : pct >= 80 ? "warn"
    : "ok";

  return {
    supported: true,
    usedBytes: mem.usedJSHeapSize,
    totalBytes: mem.totalJSHeapSize,
    limitBytes: mem.jsHeapSizeLimit,
    usagePct: pct,
    level,
    wasDiscarded: !!doc.wasDiscarded,
    deviceMemoryGb: nav.deviceMemory ?? null,
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
  };
}
