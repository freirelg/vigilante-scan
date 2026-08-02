import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => null);
    const summary = body?.summary;
    if (!summary || typeof summary !== 'string' || summary.length > 8000) {
      return new Response(JSON.stringify({ error: 'summary inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Lovable-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.6-flash',
        messages: [
          {
            role: 'system',
            content:
              'Você é um especialista em cibersegurança. Com base nas evidências medidas no navegador ' +
              'e no histórico de scores, escreva recomendações de segurança em português do Brasil, ' +
              'em linguagem simples para qualquer pessoa entender. Responda somente com uma lista de ' +
              '6 a 10 itens, cada um em uma linha começando com "- ", começando pelas mais urgentes. ' +
              'Cada item deve ter no máximo 200 caracteres e dizer o que fazer na prática. Sem títulos, sem markdown extra.',
          },
          { role: 'user', content: summary },
        ],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em instantes.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!res.ok) {
      const detail = await res.text();
      return new Response(JSON.stringify({ error: 'Falha na análise de IA', detail: detail.slice(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const recommendations = text
      .split('\n')
      .map((l: string) => l.replace(/^\s*[-*•\d.)]+\s*/, '').trim())
      .filter((l: string) => l.length > 0)
      .slice(0, 10);

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
