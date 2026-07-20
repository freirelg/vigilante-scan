// Real browser/device signals to replace Math.random() simulations
import { getStorageInfo } from "@/lib/deviceStorage";

export interface RealSignals {
  https: boolean;
  hsts: boolean | null; // null = unknown (blocked by CORS)
  csp: boolean | null;
  serviceWorker: boolean;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
  online: boolean;
  storageUsagePct: number; // 0-100
  persistentStorage: boolean;
  permissionsGranted: number; // count of sensitive perms granted
  permissionsTotal: number;
  crossOriginIsolated: boolean;
  secureContext: boolean;
}

const SENSITIVE_PERMS = [
  "geolocation",
  "notifications",
  "camera",
  "microphone",
  "clipboard-read",
] as const;

async function checkSelfHeaders(): Promise<{ hsts: boolean | null; csp: boolean | null }> {
  try {
    const res = await fetch(window.location.origin + "/", { method: "HEAD", cache: "no-store" });
    return {
      hsts: !!res.headers.get("strict-transport-security"),
      csp: !!res.headers.get("content-security-policy"),
    };
  } catch {
    return { hsts: null, csp: null };
  }
}

async function checkPermissions(): Promise<{ granted: number; total: number }> {
  if (!("permissions" in navigator)) return { granted: 0, total: 0 };
  let granted = 0;
  let total = 0;
  for (const name of SENSITIVE_PERMS) {
    try {
      // @ts-ignore - some names are experimental
      const p = await navigator.permissions.query({ name });
      total++;
      if (p.state === "granted") granted++;
    } catch {
      // permission name not supported in this browser — skip
    }
  }
  return { granted, total };
}

export async function collectRealSignals(): Promise<RealSignals> {
  const [{ hsts, csp }, perms, storage] = await Promise.all([
    checkSelfHeaders(),
    checkPermissions(),
    getStorageInfo().catch(() => null),
  ]);

  const usagePct = storage && storage.quota
    ? Math.round((storage.usage / storage.quota) * 100)
    : 0;

  let persistent = false;
  try {
    persistent = "storage" in navigator && "persisted" in navigator.storage
      ? await navigator.storage.persisted()
      : false;
  } catch {}

  return {
    https: window.location.protocol === "https:",
    hsts,
    csp,
    serviceWorker: "serviceWorker" in navigator && !!(await navigator.serviceWorker?.getRegistration().catch(() => null)),
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack === "1",
    online: navigator.onLine,
    storageUsagePct: usagePct,
    persistentStorage: persistent,
    permissionsGranted: perms.granted,
    permissionsTotal: perms.total,
    crossOriginIsolated: (window as any).crossOriginIsolated === true,
    secureContext: window.isSecureContext,
  };
}
