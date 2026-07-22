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
