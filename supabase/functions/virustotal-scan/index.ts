import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const VT_API = 'https://www.virustotal.com/api/v3';
const MAX_BODY_BYTES = 8 * 1024;
const REQUEST_TIMEOUT_MS = 5_000;

interface ScanRequest {
  target: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function isPrivateOrReservedIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((n) => n < 0 || n > 255)) return true;
  const [a, b, c] = octets;
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224;
}

function validateTarget(input: unknown): URL | null {
  if (typeof input !== 'string') return null;
  const target = input.trim();
  if (!target || target.length > 2048 || /[\u0000-\u001f\u007f]/.test(target)) return null;

  let candidate = target;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) candidate = 'https://' + candidate;
  if (!/^https?:\/\//i.test(candidate)) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') ||
      host.endsWith('.local') || host.endsWith('.internal') ||
      host.endsWith('.test') || host.endsWith('.example') || host.endsWith('.invalid')) {
    return null;
  }

  // Do not send private/reserved IP literals to the external scanning provider.
  if (host.includes(':')) return null; // IPv6 literal
  if (/^\d+(?:\.\d+){3}$/.test(host)) {
    if (isPrivateOrReservedIpv4(host)) return null;
  } else if (!host.includes('.')) {
    return null;
  }

  return parsed;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405);
  }
  if (!(req.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    return jsonResponse({ error: 'Content-Type deve ser application/json.' }, 415);
  }

  try {
    const apiKey = Deno.env.get('VIRUSTOTAL_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'Serviço de análise indisponível.' }, 503);

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Requisição muito grande.' }, 413);
    }

    let body: ScanRequest;
    try {
      body = JSON.parse(rawBody) as ScanRequest;
    } catch {
      return jsonResponse({ error: 'JSON inválido.' }, 400);
    }

    const parsed = validateTarget(body?.target);
    if (!parsed) return jsonResponse({ error: 'URL ou domínio inválido ou não permitido.' }, 400);
    const url = parsed.toString();

    const submitRes = await fetchWithTimeout(`${VT_API}/urls`, {
      method: 'POST',
      headers: {
        'x-apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ url }).toString(),
    });

    if (!submitRes.ok) {
      // Do not return the upstream response body; it may expose provider details.
      return jsonResponse({ error: 'Não foi possível iniciar a análise externa.' }, 502);
    }

    const submitJson = await submitRes.json();
    const analysisId = submitJson?.data?.id;
    if (typeof analysisId !== 'string' || !analysisId || analysisId.length > 512) {
      return jsonResponse({ error: 'Resposta inválida do serviço de análise.' }, 502);
    }

    let stats: Record<string, number> | null = null;
    let attributes: Record<string, unknown> | null = null;

    for (let i = 0; i < 8; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const analysisRes = await fetchWithTimeout(
        `${VT_API}/analyses/${encodeURIComponent(analysisId)}`,
        { headers: { 'x-apikey': apiKey } },
      );
      if (!analysisRes.ok) continue;

      const analysisJson = await analysisRes.json();
      const nextAttributes = analysisJson?.data?.attributes;
      if (nextAttributes?.status === 'completed' && nextAttributes?.stats && typeof nextAttributes.stats === 'object') {
        attributes = nextAttributes as Record<string, unknown>;
        stats = nextAttributes.stats as Record<string, number>;
        break;
      }
    }

    if (!stats || !attributes) {
      return jsonResponse({
        status: 'queued',
        message: 'A análise está na fila. Tente novamente em alguns segundos.',
        target: url,
      });
    }

    const malicious = Number(stats.malicious) || 0;
    const suspicious = Number(stats.suspicious) || 0;
    const harmless = Number(stats.harmless) || 0;
    const undetected = Number(stats.undetected) || 0;
    const total = malicious + suspicious + harmless + undetected;

    const results = (attributes.results && typeof attributes.results === 'object')
      ? attributes.results as Record<string, { category?: string; result?: string }>
      : {};
    const detections = Object.entries(results)
      .filter(([, result]) => result?.category === 'malicious' || result?.category === 'suspicious')
      .map(([engine, result]) => ({
        engine: engine.slice(0, 100),
        category: result.category,
        result: typeof result.result === 'string' ? result.result.slice(0, 200) : null,
      }))
      .slice(0, 20);

    const verdict = malicious > 0 ? 'malicious' : suspicious > 0 ? 'suspicious' : 'clean';

    return jsonResponse({
      status: 'completed',
      target: url,
      host: parsed.hostname,
      verdict,
      stats: { malicious, suspicious, harmless, undetected, total },
      detections,
      scannedAt: new Date().toISOString(),
    });
  } catch {
    return jsonResponse({ error: 'Falha temporária ao executar a análise. Tente novamente.' }, 502);
  }
});
