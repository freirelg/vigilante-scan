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
