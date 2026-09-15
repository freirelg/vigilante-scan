// Package C: Fingerprint changes + Behavioral anomalies
// - Captura fingerprint do dispositivo/navegador e compara com baseline salvo
// - Monitora sinais comportamentais (eventos untrusted, jitter de timing, foco anômalo)

import type { IntrusionCheck, Severity } from "./intrusionSignals";

const FP_KEY = "freirenet:fingerprint:v1";
const BEHAVIOR_KEY = "freirenet:behavior:v1";

// -------- Fingerprint collection --------
interface Fingerprint {
  userAgent: string;
  language: string;
  languages: string;
  platform: string;
  timezone: string;
  timezoneOffset: number;
  screen: string;          // "WxH@dpr"
  colorDepth: number;
  hardwareConcurrency: number;
  deviceMemory: number | null;
  webglVendor: string;
  webglRenderer: string;
  canvasHash: string;
  audioHash: string;
  touch: boolean;
  cookieEnabled: boolean;
  doNotTrack: string;
  capturedAt: number;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function getWebGL(): { vendor: string; renderer: string } {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return { vendor: "n/a", renderer: "n/a" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = ext ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR));
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    return { vendor, renderer };
  } catch {
    return { vendor: "erro", renderer: "erro" };
  }
}

async function getCanvasHash(): Promise<string> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 30;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-ctx";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Freirenet-SecureGuard 🛡️", 2, 2);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("Freirenet-SecureGuard 🛡️", 4, 4);
    return await sha256Hex(canvas.toDataURL());
  } catch {
    return "erro";
  }
}

async function getAudioHash(): Promise<string> {
  try {
    const AC = (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext) as typeof OfflineAudioContext | undefined;
    if (!AC) return "no-audio";
    const ctx = new AC(1, 5000, 44100);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 10000;
    const comp = ctx.createDynamicsCompressor();
    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start();
    const buf = await ctx.startRendering();
    const data = buf.getChannelData(0).slice(0, 500);
    let sum = 0;
    for (const v of data) sum += Math.abs(v);
    return await sha256Hex(sum.toString());
  } catch {
    return "erro";
  }
}

export async function collectFingerprint(): Promise<Fingerprint> {
  const webgl = getWebGL();
  const [canvasHash, audioHash] = await Promise.all([getCanvasHash(), getAudioHash()]);
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: (navigator.languages || []).join(","),
    platform: navigator.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    screen: `${screen.width}x${screen.height}@${window.devicePixelRatio}`,
    colorDepth: screen.colorDepth,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: (navigator as any).deviceMemory ?? null,
    webglVendor: webgl.vendor,
    webglRenderer: webgl.renderer,
    canvasHash,
    audioHash,
    touch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack || "unset",
    capturedAt: Date.now(),
  };
}

function loadBaseline(): Fingerprint | null {
  try {
    const raw = localStorage.getItem(FP_KEY);
    return raw ? (JSON.parse(raw) as Fingerprint) : null;
  } catch {
    return null;
  }
}

export function saveBaseline(fp: Fingerprint) {
  try {
    localStorage.setItem(FP_KEY, JSON.stringify(fp));
  } catch {}
}

export function clearBaseline() {
  try {
    localStorage.removeItem(FP_KEY);
  } catch {}
}

// -------- 9. Fingerprint change detection --------
export async function checkFingerprintChanges(): Promise<IntrusionCheck & { fingerprint: Fingerprint }> {
  const current = await collectFingerprint();
  const baseline = loadBaseline();

  // Campos considerados "estáveis" — mudanças aqui são suspeitas
  const criticalFields: (keyof Fingerprint)[] = [
    "platform",
    "webglVendor",
    "webglRenderer",
    "canvasHash",
    "audioHash",
    "hardwareConcurrency",
    "deviceMemory",
  ];
  const softFields: (keyof Fingerprint)[] = [
    "userAgent",
    "language",
    "languages",
    "timezone",
    "timezoneOffset",
    "screen",
    "colorDepth",
    "touch",
    "doNotTrack",
  ];

  if (!baseline) {
    saveBaseline(current);
    return {
      id: "fingerprint",
      title: "Identidade do seu aparelho",
      description: "Guardamos como seu aparelho é hoje. Na próxima análise comparamos.",
      severity: "safe",
      details:
        "Anotamos as características do seu aparelho (tela, som, memória, fuso horário) para perceber mudanças estranhas depois. Isso fica salvo só no seu celular.",
      evidence: [
        `WebGL: ${current.webglRenderer}`,
        `Canvas: ${current.canvasHash}`,
        `Timezone: ${current.timezone}`,
      ],
      fingerprint: current,
    };
  }

  const criticalDiffs: string[] = [];
  const softDiffs: string[] = [];

  for (const f of criticalFields) {
    if (String(current[f]) !== String(baseline[f])) {
      criticalDiffs.push(`${f}: "${baseline[f]}" → "${current[f]}"`);
    }
  }
  for (const f of softFields) {
    if (String(current[f]) !== String(baseline[f])) {
      softDiffs.push(`${f}: "${baseline[f]}" → "${current[f]}"`);
    }
  }

  const evidence = [...criticalDiffs, ...softDiffs].slice(0, 8);
  let severity: Severity = "safe";
  let description = "Seu aparelho continua igual ao registrado.";

  if (criticalDiffs.length > 0) {
    severity = "danger";
    description = `⚠️ ${criticalDiffs.length} mudança(s) importante(s) no seu aparelho. Alguém pode estar usando sua conta em outro lugar.`;
  } else if (softDiffs.length >= 3) {
    severity = "warn";
    description = `${softDiffs.length} detalhes mudaram. Atualizar o navegador ou usar VPN costuma causar isso.`;
  } else if (softDiffs.length > 0) {
    description = `${softDiffs.length} pequena(s) mudança(s) — nada preocupante.`;
  }

  return {
    id: "fingerprint",
    title: "Identidade do seu aparelho",
    description,
    severity,
    details:
      "Comparamos as características de hoje com as que foram guardadas antes. Se mudarem muito sem você trocar de celular, pode ser sinal de que sua conta está sendo usada em outro aparelho.",
    evidence,
    fingerprint: current,
  };
}

// -------- 10. Behavioral anomaly monitoring --------
interface BehaviorStats {
  untrustedEvents: number;
  totalEvents: number;
  visibilityFlips: number;
  focusLossDuringInput: number;
  keystrokeIntervals: number[]; // ms entre keydowns
  mouseMoves: number;
  keyDowns: number;
  lastResetAt: number;
}

let stats: BehaviorStats = loadBehavior();
let lastKeyAt = 0;
let inputHasFocus = false;
let listenersAttached = false;

function loadBehavior(): BehaviorStats {
  try {
    const raw = sessionStorage.getItem(BEHAVIOR_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    untrustedEvents: 0,
    totalEvents: 0,
    visibilityFlips: 0,
    focusLossDuringInput: 0,
    keystrokeIntervals: [],
    mouseMoves: 0,
    keyDowns: 0,
    lastResetAt: Date.now(),
  };
}

function persistBehavior() {
  try {
    sessionStorage.setItem(BEHAVIOR_KEY, JSON.stringify(stats));
  } catch {}
}

export function startBehaviorMonitor() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;

  const onPointer = (e: PointerEvent | MouseEvent) => {
    stats.totalEvents++;
    stats.mouseMoves++;
    if (!(e as any).isTrusted) stats.untrustedEvents++;
  };
  const onKey = (e: KeyboardEvent) => {
    stats.totalEvents++;
    stats.keyDowns++;
    if (!e.isTrusted) stats.untrustedEvents++;
    const now = performance.now();
    if (lastKeyAt > 0) {
      const dt = now - lastKeyAt;
      if (dt < 5000) {
        stats.keystrokeIntervals.push(dt);
        if (stats.keystrokeIntervals.length > 200) stats.keystrokeIntervals.shift();
      }
    }
    lastKeyAt = now;
  };
  const onVisibility = () => {
    stats.visibilityFlips++;
    if (document.visibilityState === "hidden" && inputHasFocus) {
      stats.focusLossDuringInput++;
    }
    persistBehavior();
  };
  const onFocusIn = (e: FocusEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || (t as HTMLElement).isContentEditable)) {
      inputHasFocus = true;
    }
  };
  const onFocusOut = () => {
    inputHasFocus = false;
  };

  window.addEventListener("mousemove", onPointer, { passive: true });
  window.addEventListener("pointerdown", onPointer as any, { passive: true });
  window.addEventListener("keydown", onKey, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
}

export function resetBehaviorStats() {
  stats = {
    untrustedEvents: 0,
    totalEvents: 0,
    visibilityFlips: 0,
    focusLossDuringInput: 0,
    keystrokeIntervals: [],
    mouseMoves: 0,
    keyDowns: 0,
    lastResetAt: Date.now(),
  };
  persistBehavior();
}

export function checkBehavioralAnomalies(): IntrusionCheck {
  const evidence: string[] = [];
  const durationMin = Math.max(1, (Date.now() - stats.lastResetAt) / 60000);

  evidence.push(`Eventos observados: ${stats.totalEvents} em ${durationMin.toFixed(1)}min`);
  evidence.push(`Mouse moves: ${stats.mouseMoves} · Keydowns: ${stats.keyDowns}`);
  evidence.push(`Eventos não-confiáveis (isTrusted=false): ${stats.untrustedEvents}`);
  evidence.push(`Trocas de aba/visibilidade: ${stats.visibilityFlips}`);
  evidence.push(`Perda de foco durante digitação: ${stats.focusLossDuringInput}`);

  // Timing analysis: intervalos de teclado
  let jitterPct = 0;
  let avgInterval = 0;
  if (stats.keystrokeIntervals.length >= 8) {
    avgInterval = stats.keystrokeIntervals.reduce((a, b) => a + b, 0) / stats.keystrokeIntervals.length;
    const variance =
      stats.keystrokeIntervals.reduce((acc, v) => acc + (v - avgInterval) ** 2, 0) /
      stats.keystrokeIntervals.length;
    const stddev = Math.sqrt(variance);
    jitterPct = avgInterval > 0 ? (stddev / avgInterval) * 100 : 0;
    evidence.push(`Intervalo médio de teclas: ${avgInterval.toFixed(0)}ms (jitter ${jitterPct.toFixed(0)}%)`);
  }

  let severity: Severity = "safe";
  let description = "Nenhuma anomalia comportamental detectada.";

  const untrustedRatio = stats.totalEvents > 0 ? stats.untrustedEvents / stats.totalEvents : 0;

  if (untrustedRatio > 0.1 && stats.untrustedEvents > 3) {
    severity = "danger";
    description = `⚠️ ${(untrustedRatio * 100).toFixed(0)}% dos toques e cliques não vieram de você. Algo pode estar agindo sozinho no aparelho.`;
  } else if (stats.keystrokeIntervals.length >= 12 && jitterPct < 8 && avgInterval > 0) {
    severity = "warn";
    description = `A digitação está regular demais (${jitterPct.toFixed(0)}% de variação) — parece feita por um programa, não por uma pessoa.`;
  } else if (stats.focusLossDuringInput >= 3) {
    severity = "warn";
    description = `A tela saiu do lugar ${stats.focusLossDuringInput} vezes enquanto você digitava — pode ser uma tela falsa por cima tentando pegar seus dados.`;
  } else if (stats.totalEvents < 5 && durationMin > 1) {
    description = "Ainda temos poucos dados — use o app um pouco para melhorar a análise.";
  }

  return {
    id: "behavior",
    title: "Comportamento estranho no uso",
    description,
    severity,
    details:
      "Observamos se os toques e a digitação parecem vir de você ou de um programa, e se a tela perde o foco enquanto você escreve. Programas invasores costumam escorregar em pelo menos um desses sinais.",
    evidence,
  };
}

// -------- Aggregate --------
export async function runPackageCScan(): Promise<IntrusionCheck[]> {
  const fp = await checkFingerprintChanges();
  const behavior = checkBehavioralAnomalies();
  // Remove o extra 'fingerprint' key antes de retornar como IntrusionCheck puro
  const { fingerprint: _fp, ...fpCheck } = fp;
  return [fpCheck, behavior];
}
