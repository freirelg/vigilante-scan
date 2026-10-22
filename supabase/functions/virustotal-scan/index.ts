import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const VT_API = 'https://www.virustotal.com/api/v3';
const JSON_HEADERS = {
  ...corsHeaders,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

interface ScanRequest {
  target?: unknown;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405);
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse({ error: 'Content-Type deve ser application/json' }, 415);
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return jsonResponse({ error: 'Requisição muito grande' }, 413);
  }

  try {
    const apiKey = Deno.env.get('VIRUSTOTAL_API_KEY');
    if (!apiKey) {
      // Do not expose secret/configuration details to callers.
      console.error('VirusTotal scan is missing server configuration.');
      return jsonResponse({ error: 'Serviço de análise temporariamente indisponível' }, 503);
    }

    let body: ScanRequest;
    try {
      body = await req.json() as ScanRequest;
    } catch {
      return jsonResponse({ error: 'Corpo JSON inválido' }, 400);
    }

    if (typeof body.target !== 'string') {
      return jsonResponse({ error: 'Informe uma URL ou domínio válido' }, 400);
    }

    const target = body.target.trim();
    if (!target || target.length > 2048 || /[\u0000-\u001F\u007F]/.test(target)) {
      return jsonResponse({ error: 'URL ou domínio inválido' }, 400);
    }

    // Accept only web URLs. Domains without a scheme default to HTTPS.
    const candidate = /^https?:\/\//i.test(target) ? target : `https://${target}`;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      return jsonResponse({ error: 'URL malformada' }, 400);
    }

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      return jsonResponse({ error: 'Use uma URL HTTP/HTTPS válida, sem credenciais embutidas' }, 400);
    }

    // Fragments are client-side only and should not be sent to the reputation provider.
    parsed.hash = '';
    const url = parsed.toString();

    const submitRes = await fetch(`${VT_API}/urls`, {
      method: 'POST',
      headers: {
        'x-apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `url=${encodeURIComponent(url)}`,
      signal: AbortSignal.timeout(12000),
    });

    if (!submitRes.ok) {
      // Keep provider response bodies and internal details out of public API responses.
      console.error('VirusTotal URL submission failed with status:', submitRes.status);
      return jsonResponse({ error: 'Não foi possível enviar a URL para análise neste momento' }, 502);
    }

    const submitJson = await submitRes.json();
    const analysisId = submitJson?.data?.id;
    if (typeof analysisId !== 'string' || !analysisId) {
      console.error('VirusTotal returned an unexpected submission response.');
      return jsonResponse({ error: 'Resposta inválida do serviço de análise' }, 502);
    }

    let stats: Record<string, unknown> | null = null;
    let attributes: Record<string, unknown> | null = null;

    // Poll for up to ~8 seconds; callers can retry if the provider is still processing.
    for (let i = 0; i < 8; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const analysisRes = await fetch(
        `${VT_API}/analyses/${encodeURIComponent(analysisId)}`,
        {
          headers: { 'x-apikey': apiKey },
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!analysisRes.ok) continue;

      const analysisJson = await analysisRes.json();
      const candidateAttributes = analysisJson?.data?.attributes;
      if (!candidateAttributes || typeof candidateAttributes !== 'object') continue;

      attributes = candidateAttributes as Record<string, unknown>;
      if (attributes.status === 'completed') {
        const candidateStats = attributes.stats;
        if (candidateStats && typeof candidateStats === 'object') {
          stats = candidateStats as Record<string, unknown>;
        }
        break;
      }
    }

    if (!stats || !attributes) {
      return jsonResponse({
        status: 'queued',
        message: 'Análise em fila no VirusTotal. Tente novamente em alguns segundos.',
        target: url,
      }, 202);
    }

    const count = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

    const malicious = count(stats.malicious);
    const suspicious = count(stats.suspicious);
    const harmless = count(stats.harmless);
    const undetected = count(stats.undetected);
    const total = malicious + suspicious + harmless + undetected;

    const rawResults = attributes.results;
    const detections: Array<{ engine: string; category: string; result: string | null }> = [];
    if (rawResults && typeof rawResults === 'object') {
      for (const [engine, value] of Object.entries(rawResults as Record<string, unknown>)) {
        if (!value || typeof value !== 'object') continue;
        const detection = value as Record<string, unknown>;
        if (detection.category !== 'malicious' && detection.category !== 'suspicious') continue;
        detections.push({
          engine,
          category: detection.category,
          result: typeof detection.result === 'string' ? detection.result.slice(0, 300) : null,
        });
        if (detections.length >= 20) break;
      }
    }

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
  } catch (error) {
    // Log only a generic marker; never return exception text or upstream responses to clients.
    console.error('VirusTotal scan request failed:', error instanceof Error ? error.name : 'UnknownError');
    return jsonResponse({ error: 'Falha interna ao processar a análise' }, 500);
  }
});
