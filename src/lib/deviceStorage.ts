// Real device storage utilities using browser APIs.
export interface StorageInfo {
  usage: number; // bytes
  quota: number; // bytes
  usagePct: number; // 0-100
  supported: boolean;
}

export interface CacheInfo {
  cacheCount: number;
  cacheSize: number; // bytes (approximate)
  localStorageSize: number; // bytes
  indexedDbCount: number;
}

export interface MemoryInfo {
  deviceMemoryGb: number | null; // total device RAM (approx, GB)
  jsHeapUsed: number | null; // bytes - Chrome only
  jsHeapLimit: number | null; // bytes - Chrome only
  supported: boolean;
}

export interface NetworkInfo {
  supported: boolean;
  effectiveType: string | null; // '4g', '3g', ...
  downlinkMbps: number | null;
  rttMs: number | null;
  saveData: boolean;
  online: boolean;
  type: string | null; // 'wifi', 'cellular', ...
}

export interface BatteryInfo {
  supported: boolean;
  level: number | null; // 0-1
  charging: boolean | null;
  chargingTimeSec: number | null; // seconds until full
  dischargingTimeSec: number | null; // seconds until empty
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  const nav = navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
      saveData?: boolean;
      type?: string;
      addEventListener?: (t: string, cb: () => void) => void;
    };
  };
  const c = nav.connection;
  return {
    supported: !!c,
    effectiveType: c?.effectiveType ?? null,
    downlinkMbps: typeof c?.downlink === "number" ? c.downlink : null,
    rttMs: typeof c?.rtt === "number" ? c.rtt : null,
    saveData: !!c?.saveData,
    online: navigator.onLine,
    type: c?.type ?? null,
  };
}

export async function getBatteryInfo(): Promise<BatteryInfo> {
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<{
      level: number;
      charging: boolean;
      chargingTime: number;
      dischargingTime: number;
    }>;
  };
  if (!nav.getBattery) {
    return {
      supported: false,
      level: null,
      charging: null,
      chargingTimeSec: null,
      dischargingTimeSec: null,
    };
  }
  try {
    const b = await nav.getBattery();
    return {
      supported: true,
      level: b.level,
      charging: b.charging,
      chargingTimeSec: Number.isFinite(b.chargingTime) ? b.chargingTime : null,
      dischargingTimeSec: Number.isFinite(b.dischargingTime) ? b.dischargingTime : null,
    };
  } catch {
    return {
      supported: false,
      level: null,
      charging: null,
      chargingTimeSec: null,
      dischargingTimeSec: null,
    };
  }
}

export function formatDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export async function getStorageInfo(): Promise<StorageInfo> {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0, usagePct: 0, supported: false };
  }
  const est = await navigator.storage.estimate();
  const usage = est.usage ?? 0;
  const quota = est.quota ?? 0;
  const usagePct = quota > 0 ? (usage / quota) * 100 : 0;
  return { usage, quota, usagePct, supported: true };
}

export async function getCacheInfo(): Promise<CacheInfo> {
  let cacheCount = 0;
  let cacheSize = 0;
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      cacheCount = keys.length;
      for (const key of keys) {
        const cache = await caches.open(key);
        const requests = await cache.keys();
        for (const req of requests) {
          const res = await cache.match(req);
          if (res) {
            const blob = await res.clone().blob();
            cacheSize += blob.size;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // localStorage size (chars ≈ bytes for ASCII)
  let localStorageSize = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        const v = localStorage.getItem(k) ?? "";
        localStorageSize += k.length + v.length;
      }
    }
  } catch {
    // ignore
  }

  let indexedDbCount = 0;
  const idb = indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> };
  if (idb.databases) {
    try {
      const dbs = await idb.databases();
      indexedDbCount = dbs.length;
    } catch {
      // ignore
    }
  }

  return { cacheCount, cacheSize, localStorageSize, indexedDbCount };
}

export function getMemoryInfo(): MemoryInfo {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  };
  return {
    deviceMemoryGb: nav.deviceMemory ?? null,
    jsHeapUsed: perf.memory?.usedJSHeapSize ?? null,
    jsHeapLimit: perf.memory?.jsHeapSizeLimit ?? null,
    supported: !!(nav.deviceMemory || perf.memory),
  };
}

export async function clearAllCaches(): Promise<number> {
  if (!("caches" in window)) return 0;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
  return keys.length;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ============ IndexedDB granular ============
export interface IdbDbInfo {
  name: string;
  version: number | null;
  estimatedBytes: number | null;
}

export async function listIndexedDbs(): Promise<{ supported: boolean; dbs: IdbDbInfo[] }> {
  const idb = indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string; version?: number }[]> };
  if (!idb.databases) return { supported: false, dbs: [] };
  try {
    const raw = await idb.databases();
    const dbs: IdbDbInfo[] = raw
      .filter((d) => !!d.name)
      .map((d) => ({ name: d.name!, version: d.version ?? null, estimatedBytes: null }));
    return { supported: true, dbs };
  } catch {
    return { supported: true, dbs: [] };
  }
}

export function deleteIndexedDb(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

// ============ 1st-party cookies ============
export interface CookieItem {
  name: string;
  value: string;
  size: number;
  essential: boolean;
}

const ESSENTIAL_PREFIXES = [
  "sb-", "supabase", "__Host-", "__Secure-", "csrf", "xsrf", "session", "auth",
];

function isEssential(name: string): boolean {
  const lower = name.toLowerCase();
  return ESSENTIAL_PREFIXES.some((p) => lower.startsWith(p.toLowerCase()));
}

export interface CookieInfo {
  supported: boolean;
  items: CookieItem[];
  totalSize: number;
  count: number;
  essentialCount: number;
  nonEssentialCount: number;
  nonEssentialSize: number;
}

export function getCookieInfo(): CookieInfo {
  if (typeof document === "undefined" || !("cookie" in document)) {
    return { supported: false, items: [], totalSize: 0, count: 0, essentialCount: 0, nonEssentialCount: 0, nonEssentialSize: 0 };
  }
  const raw = document.cookie || "";
  if (!raw.trim()) {
    return { supported: true, items: [], totalSize: 0, count: 0, essentialCount: 0, nonEssentialCount: 0, nonEssentialSize: 0 };
  }
  const items: CookieItem[] = raw.split(";").map((c) => {
    const idx = c.indexOf("=");
    const name = (idx >= 0 ? c.slice(0, idx) : c).trim();
    const value = idx >= 0 ? c.slice(idx + 1) : "";
    return { name, value, size: name.length + value.length + 1, essential: isEssential(name) };
  }).filter((c) => c.name.length > 0);

  const totalSize = items.reduce((s, i) => s + i.size, 0);
  const essentialCount = items.filter((i) => i.essential).length;
  const nonEssential = items.filter((i) => !i.essential);
  return {
    supported: true,
    items,
    totalSize,
    count: items.length,
    essentialCount,
    nonEssentialCount: nonEssential.length,
    nonEssentialSize: nonEssential.reduce((s, i) => s + i.size, 0),
  };
}

export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  const parts = host.split(".");
  const domains: (string | null)[] = [null, host];
  for (let i = 1; i < parts.length - 1; i++) {
    domains.push("." + parts.slice(i).join("."));
  }
  if (parts.length >= 2) domains.push("." + parts.slice(-2).join("."));
  const paths = ["/", window.location.pathname, "/" + window.location.pathname.split("/")[1]];
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  for (const d of domains) {
    for (const p of paths) {
      const domainAttr = d ? `; domain=${d}` : "";
      document.cookie = `${name}=; expires=${expires}; path=${p}${domainAttr}`;
      document.cookie = `${name}=; expires=${expires}; path=${p}${domainAttr}; SameSite=Lax`;
      document.cookie = `${name}=; expires=${expires}; path=${p}${domainAttr}; SameSite=None; Secure`;
    }
  }
}

export function clearNonEssentialCookies(): { removed: number; freed: number } {
  const info = getCookieInfo();
  let removed = 0;
  let freed = 0;
  for (const item of info.items) {
    if (item.essential) continue;
    deleteCookie(item.name);
    removed += 1;
    freed += item.size;
  }
  return { removed, freed };
}
