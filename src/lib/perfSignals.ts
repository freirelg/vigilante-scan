// Real performance signals: Web Vitals (LCP, CLS, INP) + resource weight.
export interface WebVitals {
  lcp: number | null; // ms
  cls: number | null; // unitless
  inp: number | null; // ms
  fcp: number | null; // ms
  ttfb: number | null; // ms
}

export interface ResourceEntry {
  name: string;
  short: string; // filename or last path segment
  size: number; // transferSize bytes
  duration: number; // ms
  cached: boolean;
  type: string; // initiatorType
}

export interface ResourceStats {
  total: number;
  totalBytes: number;
  cachedCount: number;
  networkCount: number;
  top: ResourceEntry[]; // heaviest first
}

type Cb = (v: WebVitals) => void;

const state: WebVitals = { lcp: null, cls: null, inp: null, fcp: null, ttfb: null };
const listeners = new Set<Cb>();
let started = false;

function emit() {
  listeners.forEach((cb) => cb({ ...state }));
}

export function startWebVitals() {
  if (started || typeof PerformanceObserver === "undefined") return;
  started = true;

  // TTFB from Navigation Timing
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) state.ttfb = Math.round(nav.responseStart);
  } catch {
    // ignore
  }

  const safeObserve = (type: string, cb: (list: PerformanceObserverEntryList) => void) => {
    try {
      const po = new PerformanceObserver(cb);
      po.observe({ type, buffered: true } as PerformanceObserverInit);
    } catch {
      // unsupported
    }
  };

  // LCP — largest so far
  safeObserve("largest-contentful-paint", (list) => {
    const entries = list.getEntries();
    const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
    if (last) state.lcp = Math.round(last.startTime);
    emit();
  });

  // FCP
  safeObserve("paint", (list) => {
    for (const e of list.getEntries()) {
      if (e.name === "first-contentful-paint") state.fcp = Math.round(e.startTime);
    }
    emit();
  });

  // CLS — sum of session windows (simplified sum of non-input-caused shifts)
  let clsValue = 0;
  safeObserve("layout-shift", (list) => {
    for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      if (!e.hadRecentInput) clsValue += e.value;
    }
    state.cls = Math.round(clsValue * 1000) / 1000;
    emit();
  });

  // INP — max event duration observed (approx). Real spec uses 98th percentile.
  let maxEvent = 0;
  safeObserve("event", (list) => {
    for (const e of list.getEntries() as (PerformanceEntry & { duration: number; interactionId?: number })[]) {
      if (e.interactionId && e.duration > maxEvent) maxEvent = e.duration;
    }
    if (maxEvent > 0) state.inp = Math.round(maxEvent);
    emit();
  });

  // Fallback first-input for browsers without "event"
  safeObserve("first-input", (list) => {
    const e = list.getEntries()[0] as (PerformanceEntry & { processingStart: number; startTime: number }) | undefined;
    if (e && state.inp == null) state.inp = Math.round(e.processingStart - e.startTime);
    emit();
  });
}

export function subscribeWebVitals(cb: Cb): () => void {
  listeners.add(cb);
  cb({ ...state });
  return () => listeners.delete(cb);
}

export function getResourceStats(topN = 5): ResourceStats {
  if (typeof performance === "undefined" || !performance.getEntriesByType) {
    return { total: 0, totalBytes: 0, cachedCount: 0, networkCount: 0, top: [] };
  }
  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  let totalBytes = 0;
  let cachedCount = 0;
  const items: ResourceEntry[] = entries.map((e) => {
    const size = e.transferSize || 0;
    // Cached: transferSize is 0 but encodedBodySize > 0, or duration is tiny with body
    const cached = size === 0 && (e.encodedBodySize || 0) > 0;
    if (cached) cachedCount++;
    totalBytes += size;
    let short = e.name;
    try {
      const u = new URL(e.name);
      short = u.pathname.split("/").filter(Boolean).pop() || u.hostname;
    } catch {
      // keep name
    }
    return {
      name: e.name,
      short,
      size,
      duration: Math.round(e.duration),
      cached,
      type: e.initiatorType || "other",
    };
  });

  const top = items
    .filter((i) => i.size > 0)
    .sort((a, b) => b.size - a.size)
    .slice(0, topN);

  return {
    total: entries.length,
    totalBytes,
    cachedCount,
    networkCount: entries.length - cachedCount,
    top,
  };
}

// Scoring thresholds per web.dev
export function rateLcp(v: number | null): "good" | "warn" | "poor" | "na" {
  if (v == null) return "na";
  return v <= 2500 ? "good" : v <= 4000 ? "warn" : "poor";
}
export function rateCls(v: number | null): "good" | "warn" | "poor" | "na" {
  if (v == null) return "na";
  return v <= 0.1 ? "good" : v <= 0.25 ? "warn" : "poor";
}
export function rateInp(v: number | null): "good" | "warn" | "poor" | "na" {
  if (v == null) return "na";
  return v <= 200 ? "good" : v <= 500 ? "warn" : "poor";
}
