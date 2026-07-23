// DNS-over-HTTPS (DoH) reachability check + Mixed Content scanner
// Both run entirely in the browser using real signals.

export interface DoHResult {
  supported: boolean;
  providers: { name: string; url: string; ok: boolean; ms: number | null }[];
  anyOk: boolean;
}

const DOH_PROVIDERS = [
  { name: "Cloudflare", url: "https://cloudflare-dns.com/dns-query?name=example.com&type=A" },
  { name: "Google", url: "https://dns.google/resolve?name=example.com&type=A" },
  { name: "Quad9", url: "https://dns.quad9.net:5053/dns-query?name=example.com&type=A" },
];

export async function checkDoH(): Promise<DoHResult> {
  const results = await Promise.all(
    DOH_PROVIDERS.map(async (p) => {
      const start = performance.now();
      try {
        const res = await fetch(p.url, {
          headers: { Accept: "application/dns-json" },
          cache: "no-store",
        });
        const ms = Math.round(performance.now() - start);
        return { name: p.name, url: p.url, ok: res.ok, ms };
      } catch {
        return { name: p.name, url: p.url, ok: false, ms: null };
      }
    })
  );
  return {
    supported: true,
    providers: results,
    anyOk: results.some((r) => r.ok),
  };
}

export interface MixedContentResult {
  pageIsHttps: boolean;
  insecureResources: { url: string; type: string }[];
  totalResources: number;
  hasCSP: boolean;
  upgradesInsecure: boolean;
}

export async function scanMixedContent(): Promise<MixedContentResult> {
  const pageIsHttps = window.location.protocol === "https:";
  const insecure: { url: string; type: string }[] = [];

  // 1. Resources already carregados via PerformanceObserver
  try {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    entries.forEach((e) => {
      if (e.name.startsWith("http://") && !e.name.includes("localhost") && !e.name.includes("127.0.0.1")) {
        insecure.push({ url: e.name, type: (e as any).initiatorType || "resource" });
      }
    });
  } catch {}

  // 2. DOM scan: img, script, link, iframe, video, audio, source
  const selectors: [string, string][] = [
    ["img[src^='http://']", "img"],
    ["script[src^='http://']", "script"],
    ["link[href^='http://']", "link"],
    ["iframe[src^='http://']", "iframe"],
    ["video[src^='http://']", "video"],
    ["audio[src^='http://']", "audio"],
    ["source[src^='http://']", "source"],
  ];
  selectors.forEach(([sel, type]) => {
    document.querySelectorAll(sel).forEach((el) => {
      const url = (el as HTMLElement).getAttribute("src") || (el as HTMLElement).getAttribute("href") || "";
      if (url && !url.includes("localhost") && !url.includes("127.0.0.1")) {
        insecure.push({ url, type });
      }
    });
  });

  // Dedupe
  const seen = new Set<string>();
  const deduped = insecure.filter((i) => {
    if (seen.has(i.url)) return false;
    seen.add(i.url);
    return true;
  });

  // 3. Verifica CSP e upgrade-insecure-requests via self-fetch
  let hasCSP = false;
  let upgradesInsecure = false;
  try {
    const res = await fetch(window.location.href, { method: "HEAD", cache: "no-store" });
    const csp = res.headers.get("content-security-policy") || "";
    hasCSP = csp.length > 0;
    upgradesInsecure = /upgrade-insecure-requests/i.test(csp);
  } catch {}

  return {
    pageIsHttps,
    insecureResources: deduped,
    totalResources: performance.getEntriesByType("resource").length,
    hasCSP,
    upgradesInsecure,
  };
}

// ---------- TLS / Protocol info ----------
export interface TlsInfo {
  protocol: string;      // ex: "h2", "h3", "http/1.1"
  label: string;         // legível
  modern: boolean;       // HTTP/2 ou HTTP/3
  sampleSize: number;
  distribution: Record<string, number>;
}

export function analyzeTls(): TlsInfo {
  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const dist: Record<string, number> = {};
  entries.forEach((e) => {
    const p = (e.nextHopProtocol || "").toLowerCase();
    if (!p) return;
    dist[p] = (dist[p] || 0) + 1;
  });

  // escolhe o protocolo dominante
  let dominant = "";
  let max = 0;
  Object.entries(dist).forEach(([k, v]) => {
    if (v > max) { max = v; dominant = k; }
  });

  const labelMap: Record<string, string> = {
    "h3": "HTTP/3 (QUIC)",
    "h3-29": "HTTP/3 (QUIC draft-29)",
    "h2": "HTTP/2",
    "http/1.1": "HTTP/1.1 (legado)",
    "http/1.0": "HTTP/1.0 (legado)",
  };

  const modern = dominant === "h2" || dominant.startsWith("h3");

  return {
    protocol: dominant || "desconhecido",
    label: labelMap[dominant] || dominant || "Desconhecido",
    modern,
    sampleSize: entries.length,
    distribution: dist,
  };
}

// ---------- Latência & Jitter reais ----------
export interface LatencyResult {
  endpoints: { name: string; url: string; samples: number[]; avg: number | null; jitter: number | null; ok: boolean }[];
  avgAll: number | null;
  jitterAll: number | null;
  anomaly: boolean; // desvio grande entre endpoints => rota suspeita
}

const LATENCY_ENDPOINTS = [
  { name: "Cloudflare", url: "https://1.1.1.1/cdn-cgi/trace" },
  { name: "Google", url: "https://www.google.com/generate_204" },
  { name: "GitHub", url: "https://api.github.com/zen" },
];

async function pingOnce(url: string): Promise<number | null> {
  const start = performance.now();
  try {
    await fetch(url, { cache: "no-store", mode: "no-cors" });
    return performance.now() - start;
  } catch {
    return null;
  }
}

export async function measureLatency(samplesPerEndpoint = 3): Promise<LatencyResult> {
  const results = await Promise.all(
    LATENCY_ENDPOINTS.map(async (ep) => {
      const samples: number[] = [];
      for (let i = 0; i < samplesPerEndpoint; i++) {
        const t = await pingOnce(ep.url);
        if (t !== null) samples.push(t);
      }
      const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null;
      let jitter: number | null = null;
      if (samples.length > 1 && avg !== null) {
        const variance = samples.reduce((s, v) => s + (v - avg) ** 2, 0) / samples.length;
        jitter = Math.sqrt(variance);
      }
      return { name: ep.name, url: ep.url, samples, avg, jitter, ok: samples.length > 0 };
    })
  );

  const avgs = results.map((r) => r.avg).filter((v): v is number => v !== null);
  const jitters = results.map((r) => r.jitter).filter((v): v is number => v !== null);
  const avgAll = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
  const jitterAll = jitters.length ? jitters.reduce((a, b) => a + b, 0) / jitters.length : null;

  // Anomalia: se o endpoint mais lento é > 3x o mais rápido, algo está roteando estranho
  let anomaly = false;
  if (avgs.length >= 2) {
    const min = Math.min(...avgs);
    const max = Math.max(...avgs);
    if (min > 0 && max / min > 3 && max - min > 200) anomaly = true;
  }

  return { endpoints: results, avgAll, jitterAll, anomaly };
}

// ---------- IP Geolocation cross-check (VPN/proxy detection) ----------
export interface IpGeoResult {
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  org: string | null;
  ipTimezone: string | null;
  browserTimezone: string;
  timezoneMatch: boolean;
  ipsMatch: boolean;
  vpnSuspected: boolean;
  sources: { name: string; ok: boolean; ip: string | null }[];
}

export async function geolocateIP(): Promise<IpGeoResult> {
  const browserTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  const sources: { name: string; ok: boolean; ip: string | null }[] = [];

  let ipapi: any = null;
  let ipifyIp: string | null = null;

  try {
    const r = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (r.ok) {
      ipapi = await r.json();
      sources.push({ name: "ipapi.co", ok: true, ip: ipapi?.ip ?? null });
    } else {
      sources.push({ name: "ipapi.co", ok: false, ip: null });
    }
  } catch {
    sources.push({ name: "ipapi.co", ok: false, ip: null });
  }

  try {
    const r = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      ipifyIp = j?.ip ?? null;
      sources.push({ name: "ipify.org", ok: true, ip: ipifyIp });
    } else {
      sources.push({ name: "ipify.org", ok: false, ip: null });
    }
  } catch {
    sources.push({ name: "ipify.org", ok: false, ip: null });
  }

  const ip = ipapi?.ip || ipifyIp;
  const ipTimezone = ipapi?.timezone || null;
  const timezoneMatch = ipTimezone ? ipTimezone === browserTimezone : true;
  const ipsMatch = !!(ipapi?.ip && ipifyIp) ? ipapi.ip === ipifyIp : true;
  const vpnSuspected = !ipsMatch || (!!ipTimezone && !timezoneMatch);

  return {
    ip,
    country: ipapi?.country_name || null,
    region: ipapi?.region || null,
    city: ipapi?.city || null,
    org: ipapi?.org || ipapi?.asn || null,
    ipTimezone,
    browserTimezone,
    timezoneMatch,
    ipsMatch,
    vpnSuspected,
    sources,
  };
}

// ---------- HSTS Preload check ----------
export interface HstsPreloadResult {
  domain: string;
  status: string; // preloaded | pending | unknown | error | local
  preloaded: boolean;
  supported: boolean;
  error?: string;
}

export async function checkHstsPreload(): Promise<HstsPreloadResult> {
  const domain = window.location.hostname;
  if (!domain || ["localhost", "127.0.0.1"].includes(domain)) {
    return { domain, status: "local", preloaded: false, supported: false };
  }
  const parts = domain.split(".");
  const apex = parts.length > 2 ? parts.slice(-2).join(".") : domain;
  try {
    const r = await fetch(
      `https://hstspreload.org/api/v2/status?domain=${encodeURIComponent(apex)}`,
      { cache: "no-store" }
    );
    if (!r.ok) {
      return {
        domain: apex,
        status: "error",
        preloaded: false,
        supported: false,
        error: `HTTP ${r.status}`,
      };
    }
    const j = await r.json();
    const status = j?.status || "unknown";
    return {
      domain: apex,
      status,
      preloaded: status === "preloaded",
      supported: true,
    };
  } catch (e: any) {
    return {
      domain: apex,
      status: "error",
      preloaded: false,
      supported: false,
      error: e?.message,
    };
  }
}

// ---------- Captive Portal detection ----------
export interface CaptivePortalResult {
  supported: boolean;
  captiveDetected: boolean;
  inconclusive: boolean;
  reason: string;
  endpoints: { name: string; url: string; ok: boolean; status: number | null; ms: number | null }[];
}

const CAPTIVE_ENDPOINTS = [
  { name: "Cloudflare", url: "http://cp.cloudflare.com/generate_204" },
  { name: "Google", url: "http://connectivitycheck.gstatic.com/generate_204" },
  { name: "Firefox", url: "http://detectportal.firefox.com/success.txt" },
];

export async function checkCaptivePortal(): Promise<CaptivePortalResult> {
  const pageIsHttps = window.location.protocol === "https:";
  const endpoints = await Promise.all(
    CAPTIVE_ENDPOINTS.map(async (e) => {
      const start = performance.now();
      try {
        const res = await fetch(e.url, { cache: "no-store", mode: "no-cors", redirect: "manual" });
        const ms = Math.round(performance.now() - start);
        // no-cors → opaque; status will be 0. Success = fetch didn't throw.
        return { name: e.name, url: e.url, ok: true, status: res.status || null, ms };
      } catch {
        return { name: e.name, url: e.url, ok: false, status: null, ms: null };
      }
    })
  );

  const allFailed = endpoints.every((e) => !e.ok);

  // Numa página HTTPS, fetch para HTTP é bloqueado por Mixed Content — não dá para inferir portal cativo com segurança.
  if (pageIsHttps && allFailed) {
    return {
      supported: false,
      captiveDetected: false,
      inconclusive: true,
      reason:
        "Página é HTTPS: navegadores bloqueiam fetch HTTP para os endpoints de detecção. Abra este site em HTTP para o teste ser conclusivo.",
      endpoints,
    };
  }

  // Se algum endpoint falhou e outros não, ou todos passaram sem erro em HTTP, é forte sinal de conexão livre.
  // Portal cativo geralmente redireciona → em no-cors o redirect é opaco e o request passa, mas com timing/URL alterada
  // (não temos como inspecionar). Aqui usamos falha total como sinal de portal ou offline.
  if (!pageIsHttps && allFailed) {
    return {
      supported: true,
      captiveDetected: true,
      inconclusive: false,
      reason: "Todos os endpoints de verificação falharam — possível portal cativo bloqueando saída, ou offline.",
      endpoints,
    };
  }

  return {
    supported: true,
    captiveDetected: false,
    inconclusive: pageIsHttps,
    reason: pageIsHttps
      ? "Endpoints responderam, mas em HTTPS o resultado é apenas indicativo."
      : "Rede aberta — nenhum portal cativo detectado.",
    endpoints,
  };
}

// ---------- Security Headers (visual) ----------
export interface SecurityHeaderItem {
  key: string;
  label: string;
  present: boolean;
  value: string | null;
  recommendation: string;
}

export interface SecurityHeadersResult {
  ok: boolean;
  score: number; // 0-100
  items: SecurityHeaderItem[];
  error?: string;
}

const HEADER_CATALOG: { key: string; label: string; recommendation: string }[] = [
  {
    key: "strict-transport-security",
    label: "HSTS (Strict-Transport-Security)",
    recommendation: "Configure 'max-age=63072000; includeSubDomains; preload' para forçar HTTPS.",
  },
  {
    key: "content-security-policy",
    label: "Content-Security-Policy (CSP)",
    recommendation: "Adicione um CSP restritivo para bloquear scripts de origem desconhecida.",
  },
  {
    key: "x-frame-options",
    label: "X-Frame-Options",
    recommendation: "Defina 'DENY' ou 'SAMEORIGIN' para prevenir clickjacking via iframe.",
  },
  {
    key: "x-content-type-options",
    label: "X-Content-Type-Options",
    recommendation: "Defina 'nosniff' para impedir MIME sniffing.",
  },
  {
    key: "referrer-policy",
    label: "Referrer-Policy",
    recommendation: "Use 'strict-origin-when-cross-origin' para vazar menos informação em links externos.",
  },
  {
    key: "permissions-policy",
    label: "Permissions-Policy",
    recommendation: "Restrinja APIs sensíveis (câmera, mic, geo) que este site não usa.",
  },
  {
    key: "cross-origin-opener-policy",
    label: "Cross-Origin-Opener-Policy",
    recommendation: "Defina 'same-origin' para isolar a janela contra ataques cross-origin.",
  },
];

export async function inspectSecurityHeaders(): Promise<SecurityHeadersResult> {
  try {
    const res = await fetch(window.location.origin + "/", { method: "HEAD", cache: "no-store" });
    const items: SecurityHeaderItem[] = HEADER_CATALOG.map((h) => {
      const value = res.headers.get(h.key);
      return {
        key: h.key,
        label: h.label,
        present: !!value,
        value,
        recommendation: h.recommendation,
      };
    });
    const present = items.filter((i) => i.present).length;
    const score = Math.round((present / items.length) * 100);
    return { ok: true, score, items };
  } catch (e: any) {
    return {
      ok: false,
      score: 0,
      items: HEADER_CATALOG.map((h) => ({
        key: h.key,
        label: h.label,
        present: false,
        value: null,
        recommendation: h.recommendation,
      })),
      error: e?.message ?? "falha ao inspecionar headers",
    };
  }
}

// ---------- Connection Quality (navigator.connection) ----------
export interface ConnectionQualityResult {
  supported: boolean;
  effectiveType: string | null; // 'slow-2g' | '2g' | '3g' | '4g'
  downlinkMbps: number | null;
  rttMs: number | null;
  saveData: boolean;
  type: string | null; // 'wifi' | 'cellular' | ...
  quality: "excellent" | "good" | "fair" | "poor" | "unknown";
}

export function checkConnectionQuality(): ConnectionQualityResult {
  const nav = navigator as Navigator & { connection?: any; mozConnection?: any; webkitConnection?: any };
  const c = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (!c) {
    return {
      supported: false,
      effectiveType: null,
      downlinkMbps: null,
      rttMs: null,
      saveData: false,
      type: null,
      quality: "unknown",
    };
  }
  const effectiveType: string | null = c.effectiveType ?? null;
  const downlink: number | null = typeof c.downlink === "number" ? c.downlink : null;
  const rtt: number | null = typeof c.rtt === "number" ? c.rtt : null;
  const saveData: boolean = !!c.saveData;
  const type: string | null = c.type ?? null;

  let quality: ConnectionQualityResult["quality"] = "unknown";
  if (effectiveType === "4g" && (downlink ?? 0) >= 5 && (rtt ?? 999) <= 100) quality = "excellent";
  else if (effectiveType === "4g") quality = "good";
  else if (effectiveType === "3g") quality = "fair";
  else if (effectiveType === "2g" || effectiveType === "slow-2g") quality = "poor";

  return { supported: true, effectiveType, downlinkMbps: downlink, rttMs: rtt, saveData, type, quality };
}

// ---------- Port Reachability (WebSocket) ----------
export interface PortTestResult {
  ports: { port: number; label: string; reachable: boolean; ms: number | null }[];
  blockedCount: number;
  totalCount: number;
  firewallSuspected: boolean;
}

const PORT_TARGETS = [
  { port: 443, label: "HTTPS", url: "wss://echo.websocket.events" },
  { port: 80, label: "HTTP/WS", url: "ws://echo.websocket.events" },
  { port: 8080, label: "Proxy alt", url: "ws://echo.websocket.events:8080" },
];

function testPort(url: string, timeoutMs = 4000): Promise<{ reachable: boolean; ms: number | null }> {
  return new Promise((resolve) => {
    const start = performance.now();
    let done = false;
    try {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        try { ws.close(); } catch {}
        resolve({ reachable: false, ms: null });
      }, timeoutMs);
      ws.onopen = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        const ms = Math.round(performance.now() - start);
        try { ws.close(); } catch {}
        resolve({ reachable: true, ms });
      };
      ws.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ reachable: false, ms: null });
      };
    } catch {
      resolve({ reachable: false, ms: null });
    }
  });
}

export async function testCommonPorts(): Promise<PortTestResult> {
  const results = await Promise.all(
    PORT_TARGETS.map(async (t) => {
      const r = await testPort(t.url);
      return { port: t.port, label: t.label, reachable: r.reachable, ms: r.ms };
    })
  );
  const blockedCount = results.filter((r) => !r.reachable).length;
  // Se 443 está bloqueado, é firewall extremo; se 80 e 8080 bloqueados mas 443 OK, é normal em redes modernas.
  const port443 = results.find((r) => r.port === 443);
  const firewallSuspected = port443 ? !port443.reachable : blockedCount === results.length;
  return { ports: results, blockedCount, totalCount: results.length, firewallSuspected };
}


