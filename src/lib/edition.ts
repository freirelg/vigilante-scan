// FreireNet edition & usage limits
export type Edition = "start" | "essencial" | "pro";

export const EDITION: Edition = "start";
export const START_SCAN_LIMIT = 10;

const KEY_USED = "freirenet_start_scans_used_v1";

export function getScansUsed(): number {
  try {
    const v = parseInt(localStorage.getItem(KEY_USED) ?? "0", 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function incrementScan(): number {
  const next = getScansUsed() + 1;
  try {
    localStorage.setItem(KEY_USED, String(next));
    window.dispatchEvent(new Event("freirenet-usage-updated"));
  } catch {}
  return next;
}

export function resetScans(): void {
  try {
    localStorage.removeItem(KEY_USED);
    window.dispatchEvent(new Event("freirenet-usage-updated"));
  } catch {}
}

export function scansRemaining(): number {
  return Math.max(0, START_SCAN_LIMIT - getScansUsed());
}

export function isBlocked(): boolean {
  return EDITION === "start" && getScansUsed() >= START_SCAN_LIMIT;
}

// Which tabs are premium (locked in Start edition)
export const PREMIUM_TABS = new Set(["intrusion", "optimize", "password", "network"]);

export function isPremiumTab(tabId: string): boolean {
  return EDITION === "start" && PREMIUM_TABS.has(tabId);
}
