import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string) {
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signToken(payload: Record<string, unknown>, secret: string) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

async function verifyToken(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecode(sig),
    enc.encode(body),
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(dec.decode(b64urlDecode(body))) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// constant-time string compare
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const signingKey = Deno.env.get("UNLOCK_SIGNING_KEY");
  const code10 = Deno.env.get("UNLOCK_CODE_10");
  const codeFull = Deno.env.get("UNLOCK_CODE_FULL");
  if (!signingKey || !code10 || !codeFull) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { action?: string; code?: string; token?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const action = body.action ?? "redeem";
  const now = Math.floor(Date.now() / 1000);

  if (action === "verify") {
    const token = typeof body.token === "string" ? body.token : "";
    const payload = token ? await verifyToken(token, signingKey) : null;
    return new Response(
      JSON.stringify({ ok: !!payload, payload }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (action === "redeem") {
    const code = typeof body.code === "string" ? body.code : "";
    if (!code || code.length > 128) {
      return new Response(JSON.stringify({ ok: false, message: "Digite uma senha." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let kind: "extra10" | "full" | null = null;
    if (safeEqual(code, codeFull)) kind = "full";
    else if (safeEqual(code, code10)) kind = "extra10";

    if (!kind) {
      return new Response(JSON.stringify({ ok: false, message: "Senha inválida." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      kind,
      iat: now,
      exp: now + 60 * 60 * 24 * 365, // 1 year
      nonce: crypto.randomUUID(),
    };
    const token = await signToken(payload, signingKey);
    const message =
      kind === "full"
        ? "Acesso livre liberado! Todos os recursos desbloqueados."
        : "+10 scans adicionados à sua cota.";
    return new Response(JSON.stringify({ ok: true, kind, token, message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "unknown_action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
