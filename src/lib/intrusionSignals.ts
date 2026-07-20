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
    description = `${suspiciousScripts.length} script(s) externos e ${foreignIframes.length} iframe(s) injetados detectados.`;
  } else if (extensionMarkers > 5) {
    severity = "warn";
    description = `Muitas extensões (${extensionMarkers} marcadores) modificando a página. Revise as instaladas.`;
  }

  return {
    id: "dom-injection",
    title: "Injeção de Código no DOM",
    description,
    severity,
    details:
      "Detecta scripts, iframes e atributos injetados por extensões maliciosas ou adware. Extensões legítimas de senha/gramática também aparecem — verifique se você reconhece as instaladas.",
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
        title: "Sequestro do Clipboard (Clipper)",
        description: "Verificação indisponível (requer HTTPS e permissão).",
        severity: "safe",
        details:
          "Malware 'clipper' troca endereços de carteiras cripto copiados. Para executar o teste, clique em 'Testar Clipboard' na área abaixo.",
      };
    }

    try {
      preservedClipboard = await navigator.clipboard.readText();
    } catch {
      // sem permissão de leitura — teste inconclusivo
      return {
        id: "clipper",
        title: "Sequestro do Clipboard (Clipper)",
        description: "Permissão de clipboard não concedida. Clique em 'Permitir' quando o navegador pedir.",
        severity: "warn",
        details:
          "Este teste escreve um endereço BTC de teste no clipboard e verifica se algo o modificou.",
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
        title: "Sequestro do Clipboard (Clipper)",
        description: "⚠️ Clipboard foi MODIFICADO após escrita. Possível malware clipper ativo.",
        severity: "danger",
        details:
          "O endereço escrito no clipboard voltou diferente do esperado. Malware clipper pode estar trocando endereços de carteiras cripto.",
        evidence,
      };
    }

    return {
      id: "clipper",
      title: "Sequestro do Clipboard (Clipper)",
      description: "Clipboard íntegro. Nenhum clipper detectado.",
      severity: "safe",
      details: "Teste escreveu e releu um endereço BTC — não houve modificação.",
    };
  } catch (err) {
    return {
      id: "clipper",
      title: "Sequestro do Clipboard (Clipper)",
      description: "Teste inconclusivo.",
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
      title: "Divergência de IP Público",
      description: "Não foi possível consultar nenhuma fonte de IP.",
      severity: "warn",
      details: "Bloqueio de rede ou firewall corporativo pode estar interferindo.",
      evidence,
    };
  }

  if (uniqueIps.length > 1) {
    return {
      id: "ip-divergence",
      title: "Divergência de IP Público",
      description: `⚠️ IPs diferentes reportados (${uniqueIps.length}). Possível proxy ou MITM ativo.`,
      severity: "danger",
      details:
        "Fontes diferentes deveriam ver o mesmo IP público. Divergência indica proxy transparente, VPN parcial ou interceptação.",
      evidence,
    };
  }

  return {
    id: "ip-divergence",
    title: "Divergência de IP Público",
    description: `IP consistente entre fontes: ${uniqueIps[0]}`,
    severity: "safe",
    details: "Todas as fontes consultadas retornaram o mesmo IP público. Sem sinais de proxy malicioso.",
    evidence,
  };
}

// -------- Aggregate --------
export async function runIntrusionScan(): Promise<IntrusionCheck[]> {
  const [dom, ip] = await Promise.all([checkDomInjection(), checkIpDivergence()]);
  // Clipboard requires user gesture — retorna placeholder inicial
  const clipboard: IntrusionCheck = {
    id: "clipper",
    title: "Sequestro do Clipboard (Clipper)",
    description: "Aguardando teste manual (requer clique).",
    severity: "safe",
    details:
      "Malware clipper troca endereços de carteira copiados. Clique em 'Testar Clipboard' para verificar.",
  };
  return [dom, clipboard, ip];
}
