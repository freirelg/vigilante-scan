// Real browser/device signals to replace Math.random() simulations
import { getStorageInfo } from "@/lib/deviceStorage";

export interface PermissionDetail {
  name: string;
  state: "granted" | "denied" | "prompt" | "unsupported";
}

export interface RealSignals {
  https: boolean;
  hsts: boolean | null;
  csp: boolean | null;
  xfo: boolean | null;
  xcto: boolean | null;
  referrerPolicy: boolean | null;
  permPolicy: boolean | null;
  serviceWorker: boolean;
  swScope: string | null;
  swControlled: boolean;
  cookiesEnabled: boolean;
  thirdPartyCookies: "allowed" | "blocked" | "unknown";
  doNotTrack: boolean;
  online: boolean;
  storageUsagePct: number;
  persistentStorage: boolean;
  permissions: PermissionDetail[];
  permissionsGranted: number;
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
  "clipboard-write",
  "persistent-storage",
] as const;

async function checkSelfHeaders() {
  try {
    const res = await fetch(window.location.origin + "/", { method: "HEAD", cache: "no-store" });
    const h = res.headers;
    return {
      hsts: !!h.get("strict-transport-security"),
      csp: !!h.get("content-security-policy"),
      xfo: !!h.get("x-frame-options"),
      xcto: !!h.get("x-content-type-options"),
      referrerPolicy: !!h.get("referrer-policy"),
      permPolicy: !!h.get("permissions-policy"),
    };
  } catch {
    return { hsts: null, csp: null, xfo: null, xcto: null, referrerPolicy: null, permPolicy: null };
  }
}

async function checkPermissions(): Promise<PermissionDetail[]> {
  if (!("permissions" in navigator)) return [];
  const results: PermissionDetail[] = [];
  for (const name of SENSITIVE_PERMS) {
    try {
      // @ts-ignore
      const p = await navigator.permissions.query({ name });
      results.push({ name, state: p.state as PermissionDetail["state"] });
    } catch {
      results.push({ name, state: "unsupported" });
    }
  }
  return results;
}

async function checkThirdPartyCookies(): Promise<"allowed" | "blocked" | "unknown"> {
  try {
    // Storage Access API — if available in the top-level and returns false, 3rd-party access is restricted
    const d = document as Document & { hasStorageAccess?: () => Promise<boolean> };
    if (typeof d.hasStorageAccess === "function") {
      const has = await d.hasStorageAccess();
      // In top-level context this usually returns true; only informative when in iframe.
      // Combine with cookieDeprecationLabel (Chrome) for a stronger hint.
      const nav = navigator as Navigator & {
        cookieDeprecationLabel?: { getValue: () => Promise<string> };
      };
      if (nav.cookieDeprecationLabel?.getValue) {
        const label = await nav.cookieDeprecationLabel.getValue();
        if (label && label.length > 0) return "blocked";
      }
      return has ? "allowed" : "blocked";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function collectRealSignals(): Promise<RealSignals> {
  const [headers, permissions, storage, thirdParty] = await Promise.all([
    checkSelfHeaders(),
    checkPermissions(),
    getStorageInfo().catch(() => null),
    checkThirdPartyCookies(),
  ]);

  const usagePct = storage && storage.quota ? Math.round((storage.usage / storage.quota) * 100) : 0;

  let persistent = false;
  try {
    persistent =
      "storage" in navigator && "persisted" in navigator.storage
        ? await navigator.storage.persisted()
        : false;
  } catch {}

  let swReg: ServiceWorkerRegistration | null = null;
  try {
    swReg = "serviceWorker" in navigator
      ? (await navigator.serviceWorker.getRegistration().catch(() => null)) ?? null
      : null;
  } catch {}

  const granted = permissions.filter((p) => p.state === "granted").length;
  const total = permissions.filter((p) => p.state !== "unsupported").length;

  return {
    https: window.location.protocol === "https:",
    ...headers,
    serviceWorker: !!swReg,
    swScope: swReg?.scope ?? null,
    swControlled: !!navigator.serviceWorker?.controller,
    cookiesEnabled: navigator.cookieEnabled,
    thirdPartyCookies: thirdParty,
    doNotTrack: navigator.doNotTrack === "1",
    online: navigator.onLine,
    storageUsagePct: usagePct,
    persistentStorage: persistent,
    permissions,
    permissionsGranted: granted,
    permissionsTotal: total,
    crossOriginIsolated: (window as any).crossOriginIsolated === true,
    secureContext: window.isSecureContext,
  };
}
