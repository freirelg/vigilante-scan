// Package A: Intrusion detection signals
// Real browser-side checks for signs of compromise

export type Severity = "safe" | "warn" | "danger";

export interface IntrusionCheck {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  details: string;
  evidence?: string[];
}

// -------- 1. DOM Injection detection --------
// Extensions/malware often inject <script> or <iframe> tags from foreign origins.
export async function checkDomInjection(): Promise<IntrusionCheck> {
  const evidence: string[] = [];
  const currentOrigin = window.location.origin;

  const scripts = Array.from(document.querySelectorAll("script[src]"));
  const iframes = Array.from(document.querySelectorAll("iframe[src]"));
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'));

  const foreignScripts = scripts.filter((s) => {
    const src = (s as HTMLScriptElement).src;
    return src && !src.startsWith(currentOrigin) && !src.startsWith("blob:") && !src.startsWith("data:");
  });
  const foreignIframes = iframes.filter((i) => {
    const src = (i as HTMLIFrameElement).src;
    return src && !src.startsWith(currentOrigin) && !src.startsWith("about:");
  });

  // Known trusted CDNs (whitelist to reduce false positives)
  const trusted = [
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "cdn.gpteng.co",
    "lovable.dev",
    "lovableproject.com",
  ];
  const suspiciousScripts = foreignScripts.filter((s) => {
    const src = (s as HTMLScriptElement).src;
    return !trusted.some((t) => src.includes(t));
  });

  suspiciousScripts.slice(0, 5).forEach((s) => {
    evidence.push(`Script externo: ${(s as HTMLScriptElement).src}`);
  });
  foreignIframes.slice(0, 3).forEach((i) => {
    const src = (i as HTMLIFrameElement).src;
    if (!trusted.some((t) => src.includes(t))) evidence.push(`iframe: ${src}`);
  });

  // Chrome extensions inject via chrome-extension:// — usually invisible to page,
  // but injected nodes often carry data-* attrs. Sample "unknown" attributes.
  const allEls = document.querySelectorAll("*");
  let extensionMarkers = 0;
  const markerPatterns = /^(data-(cbextension|adblock|grammarly|lastpass|honey|bitwarden)|__)/i;
  for (const el of Array.from(allEls).slice(0, 2000)) {
    for (const attr of Array.from(el.attributes)) {
      if (markerPatterns.test(attr.name)) {
        extensionMarkers++;
        break;
      }
    }
  }
  if (extensionMarkers > 0) {
    evidence.push(`${extensionMarkers} elementos com marcadores de extensão detectados`);
  }

  let severity: Severity = "safe";
  let description = "Nenhum script ou iframe suspeito detectado no DOM.";

  if (suspiciousScripts.length > 0 || foreignIframes.length > 2) {
    severity = "danger";
    description = `Encontramos ${suspiciousScripts.length} programa(s) de fora e ${foreignIframes.length} janela(s) escondida(s) mexendo nesta tela.`;
  } else if (extensionMarkers > 5) {
    severity = "warn";
    description = `Muitos complementos do navegador (${extensionMarkers} sinais) estão mexendo na tela. Confira o que você instalou.`;
  }

  return {
    id: "dom-injection",
    title: "Alguém mexendo na tela do app",
    description,
    severity,
    details:
      "Procura conteúdo estranho colocado na tela por complementos do navegador ou programas de propaganda. Complementos confiáveis (de senhas ou correção de texto) também podem aparecer — confira se você reconhece todos.",
    evidence,
  };
}

// -------- 2. Clipper malware detection --------
// Malware do tipo "clipper" troca endereços de carteira cripto no clipboard.
// Escrevemos um endereço de teste e lemos de volta. Só funciona sob HTTPS + gesto do usuário.
export async function checkClipboardHijack(): Promise<IntrusionCheck> {
  const evidence: string[] = [];
  // Endereços de teste burnable (não use para receber)
  const testAddress = "bc1qtestclipperfreirenetsecureguardxxxxxxxx0";
  let preservedClipboard = "";

  try {
    if (!navigator.clipboard || !window.isSecureContext) {
      return {
        id: "clipper",
        title: "Troca do que você copia",
        description: "Não dá para testar agora: precisa de conexão segura e da sua permissão.",
        severity: "safe",
        details:
          "Existem vírus que trocam o que você copia (como chave Pix ou carteira de cripto) por outro destino. Toque em 'Testar cópia' para checar.",
      };
    }

    try {
      preservedClipboard = await navigator.clipboard.readText();
    } catch {
      // sem permissão de leitura — teste inconclusivo
      return {
        id: "clipper",
        title: "Troca do que você copia",
        description: "Falta sua permissão. Toque em 'Permitir' quando o celular perguntar.",
        severity: "warn",
        details:
          "O teste copia um texto de exemplo e confere se algo trocou esse texto.",
      };
    }

    await navigator.clipboard.writeText(testAddress);
    // pequena espera para dar tempo do clipper agir
    await new Promise((r) => setTimeout(r, 200));
    const readBack = await navigator.clipboard.readText();

    // Restaurar clipboard original
    if (preservedClipboard) {
      try {
        await navigator.clipboard.writeText(preservedClipboard);
      } catch {}
    }

    if (readBack !== testAddress) {
      evidence.push(`Esperado: ${testAddress.slice(0, 24)}…`);
      evidence.push(`Recebido: ${readBack.slice(0, 60)}`);
      return {
        id: "clipper",
        title: "Troca do que você copia",
        description: "⚠️ O texto copiado foi trocado. Pode haver um vírus agindo no aparelho.",
        severity: "danger",
        details:
          "O texto voltou diferente do que foi copiado. Isso é típico de golpe que troca chave Pix ou endereço de carteira.",
        evidence,
      };
    }

    return {
      id: "clipper",
      title: "Troca do que você copia",
      description: "O que você copia está seguro. Nada foi trocado.",
      severity: "safe",
      details: "Copiamos um texto de exemplo e ele voltou igual.",
    };
  } catch (err) {
    return {
      id: "clipper",
      title: "Troca do que você copia",
      description: "Não foi possível concluir o teste.",
      severity: "safe",
      details: String(err),
    };
  }
}

// -------- 3. IP Divergence / Proxy detection --------
// Consulta múltiplos endpoints públicos. IPs divergentes = proxy/VPN/MITM.
export async function checkIpDivergence(): Promise<IntrusionCheck> {
  const evidence: string[] = [];
  const sources = [
    { name: "Cloudflare", url: "https://1.1.1.1/cdn-cgi/trace", parse: (t: string) => t.match(/ip=([^\n]+)/)?.[1] },
    { name: "ipify", url: "https://api.ipify.org?format=json", parse: (t: string) => JSON.parse(t).ip },
    { name: "ipapi", url: "https://ipapi.co/json/", parse: (t: string) => JSON.parse(t).ip },
  ];

  const ips: Record<string, string> = {};
  await Promise.all(
    sources.map(async (s) => {
      try {
        const res = await fetch(s.url, { cache: "no-store" });
        const txt = await res.text();
        const ip = s.parse(txt);
        if (ip) ips[s.name] = ip.trim();
      } catch {
        // ignore
      }
    })
  );

  const uniqueIps = Array.from(new Set(Object.values(ips)));
  Object.entries(ips).forEach(([name, ip]) => evidence.push(`${name}: ${ip}`));

  if (uniqueIps.length === 0) {
    return {
      id: "ip-divergence",
      title: "Seu endereço na internet",
      description: "Não conseguimos descobrir seu endereço na internet.",
      severity: "warn",
      details: "A rede que você usa pode estar bloqueando essa consulta.",
      evidence,
    };
  }

  if (uniqueIps.length > 1) {
    return {
      id: "ip-divergence",
      title: "Seu endereço na internet",
      description: `⚠️ Seu endereço aparece de ${uniqueIps.length} formas diferentes. Alguém pode estar no meio da sua conexão.`,
      severity: "danger",
      details:
        "Todos os testes deveriam ver o mesmo endereço. Quando muda, pode haver um intermediário espiando ou desviando sua conexão.",
      evidence,
    };
  }

  return {
    id: "ip-divergence",
    title: "Seu endereço na internet",
    description: `Seu endereço na internet está estável: ${uniqueIps[0]}`,
    severity: "safe",
    details: "Todos os testes viram o mesmo endereço. Nenhum sinal de intermediário suspeito.",
    evidence,
  };
}

// -------- Aggregate --------
export async function runIntrusionScan(): Promise<IntrusionCheck[]> {
  const [dom, ip] = await Promise.all([checkDomInjection(), checkIpDivergence()]);
  // Clipboard requires user gesture — retorna placeholder inicial
  const clipboard: IntrusionCheck = {
    id: "clipper",
    title: "Troca do que você copia",
    description: "Toque no botão para fazer o teste.",
    severity: "safe",
    details:
      "Alguns vírus trocam o que você copia. Toque em 'Testar cópia' para verificar.",
  };
  return [dom, clipboard, ip];
}
