// Wake Lock + smart power-saver mode (real browser APIs + local pub/sub)

type WakeLockSentinelLike = EventTarget & { released: boolean; release: () => Promise<void> };

export interface WakeLockStatus {
  supported: boolean;
  held: boolean;                 // this app currently holds a screen wake lock
  visibilityBlocked: boolean;    // page not visible → browser blocks request
  playingMedia: boolean;         // any <video>/<audio> playing (another common reason screen stays on)
  fullscreen: boolean;
  reason: string | null;         // human-readable summary
}

let currentSentinel: WakeLockSentinelLike | null = null;
const wakeLockSubs = new Set<() => void>();

export function subscribeWakeLock(cb: () => void): () => void {
  wakeLockSubs.add(cb);
  return () => wakeLockSubs.delete(cb);
}

function emitWakeLock() {
  wakeLockSubs.forEach((cb) => cb());
}

export function getWakeLockStatus(): WakeLockStatus {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } };
  const supported = !!nav.wakeLock;
  const visibilityBlocked = document.visibilityState !== "visible";
  const playingMedia = Array.from(document.querySelectorAll("video,audio")).some(
    (el) => !(el as HTMLMediaElement).paused && !(el as HTMLMediaElement).ended
  );
  const fullscreen = !!document.fullscreenElement;
  const held = !!currentSentinel && !currentSentinel.released;

  let reason: string | null = null;
  if (held) reason = "Este app está mantendo a tela ligada (Wake Lock ativo).";
  else if (playingMedia) reason = "Mídia em reprodução — o navegador mantém a tela ligada automaticamente.";
  else if (fullscreen) reason = "Modo tela cheia — o SO pode adiar o desligamento.";
  else reason = null;

  return { supported, held, visibilityBlocked, playingMedia, fullscreen, reason };
}

export async function requestWakeLock(): Promise<{ ok: boolean; error?: string }> {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } };
  if (!nav.wakeLock) return { ok: false, error: "Wake Lock API não suportada" };
  if (document.visibilityState !== "visible") return { ok: false, error: "Aba não está visível" };
  try {
    const s = await nav.wakeLock.request("screen");
    currentSentinel = s;
    s.addEventListener("release", () => {
      currentSentinel = null;
      emitWakeLock();
    });
    emitWakeLock();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao adquirir wake lock" };
  }
}

export async function releaseWakeLock(): Promise<boolean> {
  if (!currentSentinel) return false;
  try {
    await currentSentinel.release();
    currentSentinel = null;
    emitWakeLock();
    return true;
  } catch {
    return false;
  }
}

// Re-acquire on visibility change (browser auto-releases when tab hidden)
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && !currentSentinel && localStorage.getItem("wake-lock-desired") === "1") {
      await requestWakeLock();
    }
    emitWakeLock();
  });
}

// ------------------------ Smart power saver ------------------------

const POWER_SAVER_CLASS = "power-saver";
const LS_MODE = "power-saver-mode"; // 'auto' | 'on' | 'off'
export type PowerSaverMode = "auto" | "on" | "off";

const psSubs = new Set<() => void>();
export function subscribePowerSaver(cb: () => void): () => void {
  psSubs.add(cb);
  return () => psSubs.delete(cb);
}
function emitPs() { psSubs.forEach((c) => c()); }

export function getPowerSaverMode(): PowerSaverMode {
  const v = localStorage.getItem(LS_MODE);
  return v === "on" || v === "off" ? v : "auto";
}

export function setPowerSaverMode(mode: PowerSaverMode) {
  localStorage.setItem(LS_MODE, mode);
  emitPs();
  applyPowerSaverIfNeeded();
}

export interface PowerSaverState {
  mode: PowerSaverMode;
  active: boolean;
  reason: string;
  batteryLevel: number | null;    // 0-100
  charging: boolean | null;
  saveDataHint: boolean;          // navigator.connection.saveData
  reducedMotion: boolean;         // prefers-reduced-motion
}

let cachedBatteryLevel: number | null = null;
let cachedCharging: boolean | null = null;

async function refreshBatteryCache() {
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (t: string, cb: () => void) => void }> };
  if (!nav.getBattery) return;
  try {
    const b = await nav.getBattery();
    cachedBatteryLevel = Math.round(b.level * 100);
    cachedCharging = b.charging;
    ["levelchange", "chargingchange"].forEach((e) =>
      b.addEventListener(e, () => {
        cachedBatteryLevel = Math.round(b.level * 100);
        cachedCharging = b.charging;
        emitPs();
        applyPowerSaverIfNeeded();
      })
    );
  } catch { /* ignore */ }
}

export function getPowerSaverState(): PowerSaverState {
  const mode = getPowerSaverMode();
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  const saveDataHint = !!nav.connection?.saveData;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  let active = false;
  let reason = "Desativado";

  if (mode === "on") {
    active = true;
    reason = "Ativado manualmente";
  } else if (mode === "off") {
    active = false;
    reason = "Desativado manualmente";
  } else {
    // auto
    if (cachedBatteryLevel != null && cachedCharging === false && cachedBatteryLevel <= 20) {
      active = true;
      reason = `Bateria em ${cachedBatteryLevel}% e descarregando`;
    } else if (saveDataHint) {
      active = true;
      reason = "Save-Data ativo no sistema";
    } else if (reducedMotion) {
      active = true;
      reason = "Preferência do sistema: reduzir movimento";
    } else {
      active = false;
      reason = "Sem gatilhos — dispositivo saudável";
    }
  }

  return {
    mode,
    active,
    reason,
    batteryLevel: cachedBatteryLevel,
    charging: cachedCharging,
    saveDataHint,
    reducedMotion,
  };
}

export function applyPowerSaverIfNeeded() {
  const st = getPowerSaverState();
  document.documentElement.classList.toggle(POWER_SAVER_CLASS, st.active);
  window.dispatchEvent(new CustomEvent("power-saver-change", { detail: st }));
}

// Init once
let inited = false;
export function initPowerSaver() {
  if (inited) return;
  inited = true;
  refreshBatteryCache().then(applyPowerSaverIfNeeded);
  const nav = navigator as Navigator & { connection?: { addEventListener?: (t: string, cb: () => void) => void } };
  nav.connection?.addEventListener?.("change", () => { emitPs(); applyPowerSaverIfNeeded(); });
  window.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => {
    emitPs(); applyPowerSaverIfNeeded();
  });
  applyPowerSaverIfNeeded();
}

// React helper: subscribe to state changes (battery/save-data/mode/reduced-motion)
export function subscribePowerSaverState(cb: () => void): () => void {
  const off = subscribePowerSaver(cb);
  const onEv = () => cb();
  window.addEventListener("power-saver-change", onEv);
  return () => { off(); window.removeEventListener("power-saver-change", onEv); };
}
