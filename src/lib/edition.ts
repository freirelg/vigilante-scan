// FreireNet edition & usage limits
export type Edition = "start" | "essencial" | "pro";

export const EDITION: Edition = "start";
export const START_SCAN_LIMIT = 30;
export const INTERMEDIATE_SCAN_LIMIT = 50;

const KEY_USED = "freirenet_start_scans_used_v2";
const KEY_LEVEL = "freirenet_access_level_v2"; // 0: 30 scans, 1: 50 scans, 2: Unlimited

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

export function getAccessLevel(): number {
  try {
    const v = parseInt(localStorage.getItem(KEY_LEVEL) ?? "0", 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function getScanLimit(): number {
  const level = getAccessLevel();
  if (level >= 2) return Infinity;
  if (level === 1) return INTERMEDIATE_SCAN_LIMIT;
  return START_SCAN_LIMIT;
}

export function isUnlocked(): boolean {
  return getAccessLevel() >= 2;
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

// Limite de scans reativado conforme solicitado
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
  if (isUnlocked()) return false;
  return PREMIUM_TABS.has(tabId);
}

export type RedeemResult =
  | { ok: true; kind: "level50" | "full"; message: string }
  | { ok: false; message: string };

export function redeemCode(code: string): RedeemResult {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return { ok: false, message: "Digite uma senha." };
  
  if (trimmed === UNLOCK_CODES.full) {
    try {
      localStorage.setItem(KEY_LEVEL, "2");
      window.dispatchEvent(new Event("freirenet-usage-updated"));
    } catch {}
    return { ok: true, kind: "full", message: "Acesso livre liberado! Todos os recursos desbloqueados." };
  }
  
  if (trimmed === UNLOCK_CODES.level50) {
    try {
      localStorage.setItem(KEY_LEVEL, "1");
      window.dispatchEvent(new Event("freirenet-usage-updated"));
    } catch {}
    return { ok: true, kind: "level50", message: "Limite estendido para 50 scans liberado!" };
  }
  
  return { ok: false, message: "Senha inválida." };
}
