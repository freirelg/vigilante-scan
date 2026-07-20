import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const VT_API = 'https://www.virustotal.com/api/v3';

interface ScanRequest {
  target: string; // URL or domain
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('VIRUSTOTAL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'VIRUSTOTAL_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { target } = (await req.json()) as ScanRequest;
    if (!target || typeof target !== 'string' || target.length > 2048) {
      return new Response(
        JSON.stringify({ error: 'target inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Normalizar: se não tiver protocolo, tratar como domínio
    let url = target.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: 'URL malformada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Submeter URL para análise
    const submitRes = await fetch(`${VT_API}/urls`, {
      method: 'POST',
      headers: {
        'x-apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `url=${encodeURIComponent(url)}`,
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      return new Response(
        JSON.stringify({ error: 'Falha na submissão VirusTotal', detail: errText }),
        { status: submitRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const submitJson = await submitRes.json();
    const analysisId: string = submitJson.data.id;

    // 2. Poll do resultado (até ~8s)
    let stats: any = null;
    let attributes: any = null;
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const analysisRes = await fetch(`${VT_API}/analyses/${analysisId}`, {
        headers: { 'x-apikey': apiKey },
      });
      if (!analysisRes.ok) continue;
      const aJson = await analysisRes.json();
      attributes = aJson.data.attributes;
      if (attributes.status === 'completed') {
        stats = attributes.stats;
        break;
      }
    }

    if (!stats) {
      return new Response(
        JSON.stringify({
          status: 'queued',
          message: 'Análise em fila no VirusTotal, tente novamente em alguns segundos.',
          target: url,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    const harmless = stats.harmless || 0;
    const undetected = stats.undetected || 0;
    const total = malicious + suspicious + harmless + undetected;

    // Extrair engines que flagraram
    const results = attributes.results || {};
    const detections = Object.entries(results)
      .filter(([, r]: any) => r.category === 'malicious' || r.category === 'suspicious')
      .map(([engine, r]: any) => ({
        engine,
        category: r.category,
        result: r.result,
      }))
      .slice(0, 20);

    const verdict =
      malicious > 0 ? 'malicious' : suspicious > 0 ? 'suspicious' : 'clean';

    return new Response(
      JSON.stringify({
        status: 'completed',
        target: url,
        host: parsed.hostname,
        verdict,
        stats: { malicious, suspicious, harmless, undetected, total },
        detections,
        scannedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
