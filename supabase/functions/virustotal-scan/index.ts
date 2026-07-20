import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const VT_API = 'https://www.virustotal.com/api/v3';
const MAX_FILE_BYTES = 32 * 1024 * 1024; // 32MB — limite da API pública

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('VIRUSTOTAL_API_KEY');
    if (!apiKey) {
      return json({ error: 'VIRUSTOTAL_API_KEY não configurada' }, 500);
    }

    const contentType = req.headers.get('content-type') || '';

    // ---------- Modo ARQUIVO (multipart/form-data) ----------
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return json({ error: 'Campo "file" ausente' }, 400);
      }
      if (file.size > MAX_FILE_BYTES) {
        return json({ error: `Arquivo excede ${MAX_FILE_BYTES / 1024 / 1024}MB` }, 400);
      }

      // 1. Calcular SHA-256 e checar se VT já conhece o arquivo (mais rápido/gratuito)
      const buf = new Uint8Array(await file.arrayBuffer());
      const hashBuf = await crypto.subtle.digest('SHA-256', buf);
      const sha256 = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const lookupRes = await fetch(`${VT_API}/files/${sha256}`, {
        headers: { 'x-apikey': apiKey },
      });
      if (lookupRes.ok) {
        const known = await lookupRes.json();
        return json(formatFileResult(file.name, sha256, known.data.attributes));
      }

      // 2. Não conhecido → fazer upload
      const uploadForm = new FormData();
      uploadForm.append('file', new Blob([buf], { type: file.type || 'application/octet-stream' }), file.name);
      const submitRes = await fetch(`${VT_API}/files`, {
        method: 'POST',
        headers: { 'x-apikey': apiKey },
        body: uploadForm,
      });
      if (!submitRes.ok) {
        return json({ error: 'Falha no upload VirusTotal', detail: await submitRes.text() }, submitRes.status);
      }
      const submitJson = await submitRes.json();
      const analysisId: string = submitJson.data.id;

      // 3. Poll (arquivos costumam levar mais tempo — até ~30s)
      const attrs = await pollAnalysis(apiKey, analysisId, 15);
      if (!attrs) {
        return json({
          status: 'queued',
          message: 'Arquivo em análise no VirusTotal. Tente reenviar em ~1 minuto.',
          filename: file.name,
          sha256,
          analysisId,
        });
      }
      return json(formatFileResult(file.name, sha256, attrs, true));
    }

    // ---------- Modo URL (JSON) ----------
    const { target } = await req.json() as { target: string };
    if (!target || typeof target !== 'string' || target.length > 2048) {
      return json({ error: 'target inválido' }, 400);
    }
    let url = target.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    let parsed: URL;
    try { parsed = new URL(url); } catch { return json({ error: 'URL malformada' }, 400); }

    const submitRes = await fetch(`${VT_API}/urls`, {
      method: 'POST',
      headers: { 'x-apikey': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}`,
    });
    if (!submitRes.ok) {
      return json({ error: 'Falha na submissão VirusTotal', detail: await submitRes.text() }, submitRes.status);
    }
    const submitJson = await submitRes.json();
    const analysisId: string = submitJson.data.id;

    const attrs = await pollAnalysis(apiKey, analysisId, 8);
    if (!attrs) {
      return json({ status: 'queued', message: 'Análise em fila.', target: url });
    }
    return json(formatUrlResult(url, parsed.hostname, attrs));
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

async function pollAnalysis(apiKey: string, id: string, maxAttempts: number) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const res = await fetch(`${VT_API}/analyses/${id}`, { headers: { 'x-apikey': apiKey } });
    if (!res.ok) continue;
    const j = await res.json();
    if (j.data.attributes.status === 'completed') return j.data.attributes;
  }
  return null;
}

function formatUrlResult(url: string, host: string, attrs: any) {
  const s = attrs.stats || {};
  const results = attrs.results || {};
  const detections = Object.entries(results)
    .filter(([, r]: any) => r.category === 'malicious' || r.category === 'suspicious')
    .map(([engine, r]: any) => ({ engine, category: r.category, result: r.result }))
    .slice(0, 20);
  return {
    status: 'completed',
    kind: 'url',
    target: url,
    host,
    verdict: (s.malicious || 0) > 0 ? 'malicious' : (s.suspicious || 0) > 0 ? 'suspicious' : 'clean',
    stats: {
      malicious: s.malicious || 0,
      suspicious: s.suspicious || 0,
      harmless: s.harmless || 0,
      undetected: s.undetected || 0,
      total: (s.malicious || 0) + (s.suspicious || 0) + (s.harmless || 0) + (s.undetected || 0),
    },
    detections,
    scannedAt: new Date().toISOString(),
  };
}

function formatFileResult(filename: string, sha256: string, attrs: any, fresh = false) {
  // /files/{hash} returns last_analysis_stats; /analyses/{id} returns stats
  const s = attrs.stats || attrs.last_analysis_stats || {};
  const r = attrs.results || attrs.last_analysis_results || {};
  const detections = Object.entries(r)
    .filter(([, v]: any) => v.category === 'malicious' || v.category === 'suspicious')
    .map(([engine, v]: any) => ({ engine, category: v.category, result: v.result }))
    .slice(0, 20);
  return {
    status: 'completed',
    kind: 'file',
    filename,
    sha256,
    fresh,
    verdict: (s.malicious || 0) > 0 ? 'malicious' : (s.suspicious || 0) > 0 ? 'suspicious' : 'clean',
    stats: {
      malicious: s.malicious || 0,
      suspicious: s.suspicious || 0,
      harmless: s.harmless || 0,
      undetected: s.undetected || 0,
      total: (s.malicious || 0) + (s.suspicious || 0) + (s.harmless || 0) + (s.undetected || 0),
    },
    detections,
    scannedAt: new Date().toISOString(),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
