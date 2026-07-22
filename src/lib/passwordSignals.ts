// Password intelligence: real entropy (zxcvbn), contextual danger patterns,
// and domain criticality classification. 100% client-side.

import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import * as zxcvbnCommon from "@zxcvbn-ts/language-common";
import * as zxcvbnEn from "@zxcvbn-ts/language-en";
import * as zxcvbnPtBr from "@zxcvbn-ts/language-pt-br";

// Configure zxcvbn once (idempotent)
let zxcvbnInstance: ZxcvbnFactory | null = null;
function getZxcvbn(): ZxcvbnFactory {
  if (zxcvbnInstance) return zxcvbnInstance;
  zxcvbnInstance = new ZxcvbnFactory({
    translations: zxcvbnPtBr.translations,
    graphs: zxcvbnCommon.adjacencyGraphs,
    dictionary: {
      ...zxcvbnCommon.dictionary,
      ...zxcvbnEn.dictionary,
      ...zxcvbnPtBr.dictionary,
    },
  });
  return zxcvbnInstance;
}


// ---------- Domain / service criticality ----------
export type Criticality = "critical" | "high" | "medium" | "low";

const CRITICAL_KEYWORDS = [
  // bancos BR
  "banco", "itau", "itaú", "bradesco", "santander", "caixa", "bb.com", "brasil",
  "nubank", "inter", "c6", "picpay", "mercadopago", "sicredi", "sicoob", "safra",
  "original", "next", "will", "neon",
  // gov
  "gov.br", "receita", "detran", "inss", "meugov",
  // cripto
  "binance", "coinbase", "kraken", "mercadobitcoin", "foxbit", "bitso", "metamask",
  "trust", "ledger", "exodus",
  // email principal (chave-mestra de recuperação)
  "gmail", "outlook", "hotmail", "yahoo", "icloud", "protonmail", "proton",
  // cloud/identity
  "apple", "icloud", "microsoft", "google", "aws", "amazonaws", "azure",
  "cloudflare", "digitalocean",
];

const HIGH_KEYWORDS = [
  "paypal", "stripe", "wise", "revolut", "remessa",
  "github", "gitlab", "bitbucket",
  "shopify", "mercadolivre", "amazon", "shopee", "aliexpress",
  "1password", "bitwarden", "lastpass", "dashlane", "keepass",
  "whatsapp", "telegram", "signal",
];

const MEDIUM_KEYWORDS = [
  "facebook", "instagram", "twitter", "linkedin", "tiktok", "pinterest",
  "netflix", "spotify", "disney", "hbo", "prime", "globoplay",
  "steam", "epicgames", "playstation", "xbox", "nintendo",
  "uber", "99", "ifood", "rappi",
];

export function classifyCriticality(serviceOrUrl: string): {
  level: Criticality;
  reason: string;
} {
  const s = serviceOrUrl.toLowerCase();
  if (CRITICAL_KEYWORDS.some((k) => s.includes(k))) {
    return {
      level: "critical",
      reason: "Conta sensível (banco, e-mail principal, cripto ou governo). Comprometimento aqui abre portas para outras contas.",
    };
  }
  if (HIGH_KEYWORDS.some((k) => s.includes(k))) {
    return {
      level: "high",
      reason: "Serviço de alto valor (pagamento, código-fonte, e-commerce ou cofre de senhas).",
    };
  }
  if (MEDIUM_KEYWORDS.some((k) => s.includes(k))) {
    return {
      level: "medium",
      reason: "Rede social ou entretenimento — impacto médio em caso de invasão.",
    };
  }
  return {
    level: "low",
    reason: "Serviço geral — impacto limitado, mas evite reutilizar em contas críticas.",
  };
}

export const CRITICALITY_COLOR: Record<Criticality, string> = {
  critical: "text-destructive",
  high: "text-warning",
  medium: "text-primary",
  low: "text-muted-foreground",
};

export const CRITICALITY_LABEL: Record<Criticality, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

// ---------- Contextual danger patterns ----------
export interface DangerPattern {
  id: string;
  label: string;
  severity: "high" | "medium" | "low";
  hint: string;
}

const KEYBOARD_SEQUENCES = [
  "qwerty", "asdf", "zxcv", "1qaz", "2wsx", "qazwsx", "qwertyuiop",
  "abcdef", "12345", "123456", "1234567", "12345678", "123456789",
  "0000", "1111", "2222", "1234", "4321", "9876",
];

const COMMON_WORDS = [
  "senha", "password", "admin", "root", "login", "master", "welcome",
  "letmein", "iloveyou", "monkey", "dragon", "trustno1", "abc123",
];

export function detectDangerPatterns(
  password: string,
  context?: { service?: string; email?: string; username?: string },
): DangerPattern[] {
  const found: DangerPattern[] = [];
  const p = password.toLowerCase();

  // 1) Contém nome do serviço
  if (context?.service) {
    const service = context.service.toLowerCase().replace(/\.[a-z.]+$/, "").replace(/[^a-z0-9]/g, "");
    if (service.length >= 3 && p.includes(service)) {
      found.push({
        id: "contains-service",
        label: `Contém o nome do serviço (“${context.service}”)`,
        severity: "high",
        hint: "Atacantes testam variações do nome do site em primeiro lugar.",
      });
    }
  }

  // 2) Contém parte do e-mail / usuário
  if (context?.email) {
    const prefix = context.email.split("@")[0]?.toLowerCase();
    if (prefix && prefix.length >= 3 && p.includes(prefix)) {
      found.push({
        id: "contains-email",
        label: "Contém parte do seu e-mail",
        severity: "high",
        hint: "Seu e-mail é público — a senha não pode derivar dele.",
      });
    }
  }
  if (context?.username && context.username.length >= 3 && p.includes(context.username.toLowerCase())) {
    found.push({
      id: "contains-username",
      label: "Contém o nome de usuário",
      severity: "high",
      hint: "Nome de usuário é conhecido — combiná-lo à senha reduz drasticamente a proteção.",
    });
  }

  // 3) Sequência de teclado
  if (KEYBOARD_SEQUENCES.some((seq) => p.includes(seq))) {
    found.push({
      id: "keyboard-seq",
      label: "Sequência de teclado ou números repetidos",
      severity: "high",
      hint: "Padrões como “qwerty”, “123456” ou “0000” são testados nos primeiros milissegundos.",
    });
  }

  // 4) Palavra comum
  if (COMMON_WORDS.some((w) => p.includes(w))) {
    found.push({
      id: "common-word",
      label: "Contém palavra óbvia (senha, admin, welcome…)",
      severity: "high",
      hint: "Palavras genéricas estão no topo de qualquer wordlist.",
    });
  }

  // 5) Data (ano 1900-2099 ou dd/mm/aaaa colado)
  if (/(19|20)\d{2}/.test(p) || /\b\d{2}[-/]?\d{2}[-/]?\d{2,4}\b/.test(p)) {
    found.push({
      id: "date",
      label: "Contém data ou ano",
      severity: "medium",
      hint: "Datas de nascimento e aniversários são adivinhadas por engenharia social.",
    });
  }

  // 6) Leet trivial (P@ssw0rd, S3nh4, etc.)
  const deleeted = p
    .replace(/@/g, "a").replace(/0/g, "o").replace(/1/g, "i")
    .replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s")
    .replace(/7/g, "t").replace(/\$/g, "s");
  if (/password|senha|admin|welcome|qwerty|master/.test(deleeted)) {
    found.push({
      id: "trivial-leet",
      label: "Substituições óbvias (P@ssw0rd, S3nh4…)",
      severity: "medium",
      hint: "Ferramentas de crack reconhecem leet automaticamente — não conta como força.",
    });
  }

  // 7) Repetição excessiva de caractere
  if (/(.)\1{3,}/.test(p)) {
    found.push({
      id: "repeat",
      label: "Caracteres repetidos (aaaa, 1111…)",
      severity: "low",
      hint: "Repetições diminuem a entropia efetiva.",
    });
  }

  // 8) Apenas letras ou apenas números
  if (/^[a-z]+$/.test(p) || /^[0-9]+$/.test(p)) {
    found.push({
      id: "single-charset",
      label: "Usa apenas um tipo de caractere",
      severity: "medium",
      hint: "Misture letras, números e símbolos para aumentar drasticamente o tempo de quebra.",
    });
  }

  return found;
}

// ---------- Real strength via zxcvbn ----------
export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4;         // zxcvbn native
  strength: number;                  // 0-100 for UI
  crackTime: string;                 // human-readable
  crackTimeSeconds: number;
  warning: string;
  suggestions: string[];
  patterns: DangerPattern[];
  guessesLog10: number;
}

export function analyzeReal(
  password: string,
  context?: { service?: string; email?: string; username?: string },
): StrengthResult {
  const userInputs: string[] = [];
  if (context?.service) userInputs.push(context.service);
  if (context?.email) {
    userInputs.push(context.email);
    const prefix = context.email.split("@")[0];
    if (prefix) userInputs.push(prefix);
  }
  if (context?.username) userInputs.push(context.username);

  const result = getZxcvbn().check(password, userInputs);
  const patterns = detectDangerPatterns(password, context);

  // Map score 0-4 to 0-100, then subtract for detected patterns
  let strength = [10, 30, 55, 80, 100][result.score];
  for (const p of patterns) {
    if (p.severity === "high") strength -= 15;
    else if (p.severity === "medium") strength -= 8;
    else strength -= 3;
  }
  strength = Math.max(0, Math.min(100, strength));

  const suggestions = [
    ...(result.feedback.suggestions ?? []),
    ...patterns.map((p) => p.hint),
  ];

  return {
    score: result.score,
    strength,
    crackTime: String(result.crackTimesDisplay.offlineSlowHashing1e4PerSecond),
    crackTimeSeconds: Number(result.crackTimesSeconds.offlineSlowHashing1e4PerSecond) || 0,
    warning: result.feedback.warning ?? "",
    suggestions,
    patterns,
    guessesLog10: result.guessesLog10,
  };
}
