// FreireNet edition & usage limits
export type Edition = "start" | "essencial" | "pro";

export const EDITION: Edition = "start";
export const START_SCAN_LIMIT = 30;
export const INTERMEDIATE_SCAN_LIMIT = 50;

const KEY_USED = "freirenet_start_scans_used_v2";

export function getScansUsed(): number {
  try {
    const v = parseInt(localStorage.getItem(KEY_USED) ?? "0", 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

// Access levels must not be restored from localStorage: users can edit browser storage.
// Until a server-side licensing endpoint is deployed, all sessions remain on Start.
export function getAccessLevel(): number {
  return 0;
}

export function getScanLimit(): number {
  const level = getAccessLevel();
  if (level >= 2) return Infinity;
  if (level === 1) return INTERMEDIATE_SCAN_LIMIT;
  return START_SCAN_LIMIT;
}

export function isUnlocked(): boolean {
  return false;
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

// Limite local de interface; não deve ser usado como controle de cobrança.
export const SCAN_LIMIT_ENABLED = true;

export function scansRemaining(): number {
  if (!SCAN_LIMIT_ENABLED) return Infinity;
  const limit = getScanLimit();
  if (limit === Infinity) return Infinity;
  return Math.max(0, limit - getScansUsed());
}

export function isBlocked(): boolean {
  if (!SCAN_LIMIT_ENABLED) return false;
  if (EDITION !== "start") return false;
  const limit = getScanLimit();
  if (limit === Infinity) return false;
  return getScansUsed() >= limit;
}

// Which tabs are premium (locked in Start edition)
export const PREMIUM_TABS = new Set(["intrusion", "optimize", "password", "network"]);

export function isPremiumTab(tabId: string): boolean {
  if (EDITION !== "start") return false;
  const level = getAccessLevel();
  if (level >= 2) return false;

  if (level === 1) {
    return ["optimize", "password", "network"].includes(tabId);
  }

  return ["intrusion", "optimize", "password", "network"].includes(tabId);
}

export type RedeemResult = { ok: false; message: string };

// Deliberately fail closed: client-side codes cannot safely grant paid access.
// Implement server-side validation before re-enabling license redemption.
export function redeemCode(_code: string): RedeemResult {
  return {
    ok: false,
    message: "A validação de licenças ainda não está disponível. Tente novamente após a ativação da validação no servidor.",
  };
}
