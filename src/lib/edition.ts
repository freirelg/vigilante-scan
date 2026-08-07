// FreireNet edition & usage limits
export type Edition = "start" | "essencial" | "pro";

export const EDITION: Edition = "start";
export const START_SCAN_LIMIT = 30;
export const INTERMEDIATE_SCAN_LIMIT = 50;

const KEY_USED = "freirenet_start_scans_used_v1";
const KEY_LEVEL = "freirenet_access_level_v1"; // 0: 30 scans, 1: 50 scans, 2: Unlimited

export const UNLOCK_CODES = {
  level50: "FreireNet50",
  full: "FreireNetLivre999",
} as const;

export function getScansUsed(): number {
  try {
    const v = parseInt(localStorage.getItem(KEY_USED) ?? "0", 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function getExtraScans(): number {
  try {
    const v = parseInt(localStorage.getItem(KEY_EXTRA) ?? "0", 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function getScanLimit(): number {
  return START_SCAN_LIMIT + getExtraScans();
}

export function isUnlocked(): boolean {
  try {
    return localStorage.getItem(KEY_UNLOCKED) === "1";
  } catch {
    return false;
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

// Limite de scans temporariamente desativado
export const SCAN_LIMIT_ENABLED = false;

export function scansRemaining(): number {
  if (!SCAN_LIMIT_ENABLED) return Infinity;
  if (isUnlocked()) return Infinity;
  return Math.max(0, getScanLimit() - getScansUsed());
}

export function isBlocked(): boolean {
  if (!SCAN_LIMIT_ENABLED) return false;
  if (EDITION !== "start") return false;
  if (isUnlocked()) return false;
  return getScansUsed() >= getScanLimit();
}

// Which tabs are premium (locked in Start edition)
export const PREMIUM_TABS = new Set(["intrusion", "optimize", "password", "network"]);

export function isPremiumTab(tabId: string): boolean {
  if (EDITION !== "start") return false;
  if (isUnlocked()) return false;
  return PREMIUM_TABS.has(tabId);
}

export type RedeemResult =
  | { ok: true; kind: "extra10"; message: string }
  | { ok: true; kind: "full"; message: string }
  | { ok: false; message: string };

export function redeemCode(code: string): RedeemResult {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return { ok: false, message: "Digite uma senha." };
  if (trimmed === UNLOCK_CODES.full) {
    try {
      localStorage.setItem(KEY_UNLOCKED, "1");
      window.dispatchEvent(new Event("freirenet-usage-updated"));
    } catch {}
    return { ok: true, kind: "full", message: "Acesso livre liberado! Todos os recursos desbloqueados." };
  }
  if (trimmed === UNLOCK_CODES.extra10) {
    try {
      const next = getExtraScans() + 10;
      localStorage.setItem(KEY_EXTRA, String(next));
      window.dispatchEvent(new Event("freirenet-usage-updated"));
    } catch {}
    return { ok: true, kind: "extra10", message: "+10 scans adicionados à sua cota." };
  }
  return { ok: false, message: "Senha inválida." };
}

