// Persistent scan queue + history (localStorage)
// - Stores URL scans (VirusTotal) and file heuristic scans
// - Status lifecycle: queued -> running -> completed | failed
// - Serial processing (1 job at a time) with pub/sub for UI updates

import { supabase } from "@/integrations/supabase/client";

export type ScanKind = "url" | "file";
export type ScanStatus = "queued" | "running" | "completed" | "failed";
export type ScanVerdict = "clean" | "suspicious" | "malicious" | "unknown";

export interface ScanJob {
  id: string;
  kind: ScanKind;
  target: string;            // URL or file name
  size?: number;             // file size in bytes
  status: ScanStatus;
  verdict?: ScanVerdict;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  summary?: string;          // short human message
  data?: any;                // raw provider payload (VT stats/detections)
  error?: string;
}

const KEY = "freirenet:scan-queue:v1";
const MAX = 100;

type Listener = (jobs: ScanJob[]) => void;
const listeners = new Set<Listener>();
let processing = false;

function load(): ScanJob[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(jobs: ScanJob[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(jobs.slice(0, MAX)));
  } catch {}
  listeners.forEach((l) => l(jobs));
}

export function getJobs(): ScanJob[] {
  return load();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  fn(load());
  return () => listeners.delete(fn);
}

function update(id: string, patch: Partial<ScanJob>) {
  const jobs = load();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx === -1) return;
  jobs[idx] = { ...jobs[idx], ...patch };
  save(jobs);
}

export function enqueueUrlScan(target: string): ScanJob {
  const job: ScanJob = {
    id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()),
    kind: "url",
    target: target.trim(),
    status: "queued",
    createdAt: Date.now(),
  };
  save([job, ...load()]);
  void tick();
  return job;
}

export function enqueueFileScan(file: File): ScanJob {
  const job: ScanJob = {
    id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()),
    kind: "file",
    target: file.name,
    size: file.size,
    status: "queued",
    createdAt: Date.now(),
  };
  // Store file blob in a WeakMap-like registry (memory only, lost on reload)
  fileRegistry.set(job.id, file);
  save([job, ...load()]);
  void tick();
  return job;
}

const fileRegistry = new Map<string, File>();

export function removeJob(id: string) {
  save(load().filter((j) => j.id !== id));
  fileRegistry.delete(id);
}

export function clearFinished() {
  save(load().filter((j) => j.status === "queued" || j.status === "running"));
}

export function clearAll() {
  fileRegistry.clear();
  save([]);
}

export function retryJob(id: string) {
  update(id, {
    status: "queued",
    error: undefined,
    verdict: undefined,
    summary: undefined,
    startedAt: undefined,
    finishedAt: undefined,
  });
  void tick();
}

// ---------------- Processor ----------------
async function tick() {
  if (processing) return;
  processing = true;
  try {
    while (true) {
      const jobs = load();
      const next = jobs.find((j) => j.status === "queued");
      if (!next) break;
      update(next.id, { status: "running", startedAt: Date.now() });
      try {
        if (next.kind === "url") await runUrlScan(next.id, next.target);
        else await runFileScan(next.id);
      } catch (e: any) {
        update(next.id, {
          status: "failed",
          error: e?.message || "Erro desconhecido",
          finishedAt: Date.now(),
        });
      }
    }
  } finally {
    processing = false;
  }
}

async function runUrlScan(id: string, target: string) {
  const { data, error } = await supabase.functions.invoke("virustotal-scan", {
    body: { target },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  if (data.status === "queued") {
    update(id, {
      status: "completed",
      verdict: "unknown",
      summary: "Análise ainda em fila no VirusTotal — tente novamente em instantes.",
      data,
      finishedAt: Date.now(),
    });
    return;
  }

  const verdict: ScanVerdict =
    data.verdict === "malicious"
      ? "malicious"
      : data.verdict === "suspicious"
      ? "suspicious"
      : "clean";
  const s = data.stats || {};
  const summary =
    verdict === "clean"
      ? `Limpo em ${s.total ?? 0} engines`
      : verdict === "suspicious"
      ? `${s.suspicious} engine(s) suspeitas`
      : `${s.malicious} engine(s) detectaram malware`;

  update(id, { status: "completed", verdict, summary, data, finishedAt: Date.now() });
}

async function runFileScan(id: string) {
  const file = fileRegistry.get(id);
  if (!file) throw new Error("Arquivo não disponível (recarregue e reenvie)");

  // Basic heuristic: magic bytes + entropy + suspicious strings
  const buf = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
  const kind = detectMagic(buf);
  const entropy = shannonEntropy(buf);
  const strings = extractStrings(buf);
  const suspicious = SUSPICIOUS_PATTERNS.filter((p) => strings.match(p));
  const doubleExt = /\.(jpg|png|pdf|doc|docx|xls|xlsx|txt)\.(exe|scr|bat|cmd|vbs|js|jar|apk)$/i.test(
    file.name,
  );

  let score = 0;
  if (doubleExt) score += 60;
  if (entropy > 7.5) score += 25;
  if (suspicious.length >= 3) score += 30;
  else if (suspicious.length > 0) score += 10;
  if (kind === "PE (Windows executable)" || kind === "ELF (Linux executable)") score += 10;

  const verdict: ScanVerdict =
    score >= 60 ? "malicious" : score >= 25 ? "suspicious" : "clean";
  const summary =
    `${kind} · entropia ${entropy.toFixed(2)}` +
    (suspicious.length ? ` · ${suspicious.length} padrão(ões) suspeito(s)` : "") +
    (doubleExt ? " · extensão dupla!" : "");

  update(id, {
    status: "completed",
    verdict,
    summary,
    data: { kind, entropy, suspicious, doubleExt, score },
    finishedAt: Date.now(),
  });
}

// ---------- File heuristics helpers ----------
function detectMagic(b: Uint8Array): string {
  if (b[0] === 0x4d && b[1] === 0x5a) return "PE (Windows executable)";
  if (b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46) return "ELF (Linux executable)";
  if (b[0] === 0x50 && b[1] === 0x4b) return "ZIP/APK/Office";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "PDF";
  if (b[0] === 0x23 && b[1] === 0x21) return "Script (#!)";
  if (b[0] === 0xff && b[1] === 0xd8) return "JPEG";
  if (b[0] === 0x89 && b[1] === 0x50) return "PNG";
  return "Desconhecido";
}

function shannonEntropy(b: Uint8Array): number {
  const freq = new Array(256).fill(0);
  for (const x of b) freq[x]++;
  const len = b.length || 1;
  let H = 0;
  for (const f of freq) {
    if (!f) continue;
    const p = f / len;
    H -= p * Math.log2(p);
  }
  return H;
}

function extractStrings(b: Uint8Array): string {
  let out = "";
  let run = "";
  for (const x of b) {
    if (x >= 32 && x < 127) run += String.fromCharCode(x);
    else {
      if (run.length >= 5) out += run + "\n";
      run = "";
    }
  }
  if (run.length >= 5) out += run;
  return out;
}

const SUSPICIOUS_PATTERNS = [
  /powershell\s+-enc/i,
  /cmd\.exe/i,
  /CreateRemoteThread/i,
  /VirtualAllocEx/i,
  /WScript\.Shell/i,
  /eval\s*\(\s*atob/i,
  /base64_decode/i,
  /\.onion/i,
  /HKEY_LOCAL_MACHINE/i,
  /schtasks/i,
  /bitcoin|monero|wallet\.dat/i,
];
