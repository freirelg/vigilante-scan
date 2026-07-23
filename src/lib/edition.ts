// FreireNet edition & usage limits
import { supabase } from "@/integrations/supabase/client";

export type Edition = "start" | "essencial" | "pro";

export const EDITION: Edition = "start";
export const START_SCAN_LIMIT = 10;

const KEY_USED = "freirenet_start_scans_used_v1";
const KEY_FULL_TOKEN = "freirenet_full_token_v1";
const KEY_EXTRA_TOKENS = "freirenet_extra_tokens_v1"; // JSON array of tokens

// --- token storage helpers ---
function readTokens(): string[] {
  try {
    const raw = localStorage.getItem(KEY_EXTRA_TOKENS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeTokens(list: string[]) {
  try {
    localStorage.setItem(KEY_EXTRA_TOKENS, JSON.stringify(list));
  } catch {}
}

function readFullToken(): string | null {
  try {
    return localStorage.getItem(KEY_FULL_TOKEN);
  } catch {
    return null;
  }
}

function writeFullToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY_FULL_TOKEN, token);
    else localStorage.removeItem(KEY_FULL_TOKEN);
  } catch {}
}

// --- state derived from validated tokens (validated once at boot) ---
let cachedUnlocked = false;
let cachedExtraTokens: string[] = [];
let verifiedAtLeastOnce = false;

export function getScansUsed(): number {
  try {
    const v = parseInt(localStorage.getItem(KEY_USED) ?? "0", 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function getExtraScans(): number {
  // Each verified extra10 token grants +10 scans
  return cachedExtraTokens.length * 10;
}

export function getScanLimit(): number {
  return START_SCAN_LIMIT + getExtraScans();
}

export function isUnlocked(): boolean {
  return cachedUnlocked;
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
  if (isUnlocked()) return Infinity;
  return Math.max(0, getScanLimit() - getScansUsed());
}

export function isBlocked(): boolean {
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

// --- Backend-backed redemption & verification ---

export type RedeemResult =
  | { ok: true; kind: "extra10"; message: string }
  | { ok: true; kind: "full"; message: string }
  | { ok: false; message: string };

async function callFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("redeem-code", { body });
  if (error) throw error;
  return data as any;
}

export async function verifyStoredUnlocks(): Promise<void> {
  const fullToken = readFullToken();
  const extra = readTokens();

  // Verify full token
  if (fullToken) {
    try {
      const res = await callFn({ action: "verify", token: fullToken });
      if (res?.ok && res.payload?.kind === "full") {
        cachedUnlocked = true;
      } else {
        writeFullToken(null);
        cachedUnlocked = false;
      }
    } catch {
      // network failure: leave unlocked as-is but do not trust indefinitely
      cachedUnlocked = false;
    }
  } else {
    cachedUnlocked = false;
  }

  // Verify each extra token
  const valid: string[] = [];
  for (const t of extra) {
    try {
      const res = await callFn({ action: "verify", token: t });
      if (res?.ok && res.payload?.kind === "extra10") valid.push(t);
    } catch {
      // on network error keep token for retry next boot
      valid.push(t);
    }
  }
  cachedExtraTokens = valid;
  writeTokens(valid);
  verifiedAtLeastOnce = true;
  try {
    window.dispatchEvent(new Event("freirenet-usage-updated"));
  } catch {}
}

export function isVerified(): boolean {
  return verifiedAtLeastOnce;
}

export async function redeemCode(code: string): Promise<RedeemResult> {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return { ok: false, message: "Digite uma senha." };
  try {
    const res = await callFn({ action: "redeem", code: trimmed });
    if (!res?.ok) {
      return { ok: false, message: res?.message ?? "Senha inválida." };
    }
    if (res.kind === "full") {
      writeFullToken(res.token);
      cachedUnlocked = true;
    } else if (res.kind === "extra10") {
      const list = [...cachedExtraTokens, res.token];
      writeTokens(list);
      cachedExtraTokens = list;
    }
    try {
      window.dispatchEvent(new Event("freirenet-usage-updated"));
    } catch {}
    return { ok: true, kind: res.kind, message: res.message };
  } catch (e) {
    return { ok: false, message: "Falha ao validar no servidor. Tente novamente." };
  }
}
