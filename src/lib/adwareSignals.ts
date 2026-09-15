// Package B: Adware detection
// - Rogue Service Workers registered on this origin
// - Push notification permissions granted

import type { IntrusionCheck, Severity } from "./intrusionSignals";

// -------- 6. Strange Service Workers --------
export async function checkRogueServiceWorkers(): Promise<IntrusionCheck> {
  const evidence: string[] = [];
  if (!("serviceWorker" in navigator)) {
    return {
      id: "rogue-sw",
      title: "Programas rodando em segundo plano",
      description: "Este navegador não permite essa verificação.",
      severity: "safe",
      details: "Nada a verificar.",
    };
  }

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const currentOrigin = window.location.origin;
    const known = ["/sw.js", "/service-worker.js", "/firebase-messaging-sw.js", "/OneSignalSDKWorker.js"];

    const suspicious = regs.filter((r) => {
      const scriptURL = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      if (!scriptURL.startsWith(currentOrigin)) return true; // cross-origin SW = red flag
      const path = new URL(scriptURL).pathname;
      return !known.some((k) => path === k || path.endsWith(k));
    });

    regs.forEach((r) => {
      const url = r.active?.scriptURL || "(inativo)";
      const state = r.active?.state || "aguardando";
      evidence.push(`${url} — ${state} (scope: ${r.scope})`);
    });

    if (suspicious.length > 0) {
      return {
        id: "rogue-sw",
        title: "Programas rodando em segundo plano",
        description: `⚠️ ${suspicious.length} programa(s) desconhecido(s) rodando em segundo plano.`,
        severity: "danger",
        details:
          "Esses programas conseguem mudar o que aparece na tela, mesmo sem internet. Se você não reconhece, apague os dados do site nas configurações do navegador.",
        evidence,
      };
    }

    return {
      id: "rogue-sw",
      title: "Programas rodando em segundo plano",
      description:
        regs.length === 0
          ? "Nada rodando em segundo plano."
          : `${regs.length} programa(s) conhecido(s) rodando normalmente.`,
      severity: "safe",
      details: "Tudo pertence a este app e está em lugar conhecido.",
      evidence,
    };
  } catch (err) {
    return {
      id: "rogue-sw",
      title: "Programas rodando em segundo plano",
      description: "Não foi possível fazer essa verificação agora.",
      severity: "warn",
      details: String(err),
    };
  }
}

// -------- 7. Push notification permissions (adware clássico) --------
export async function checkPushPermissions(): Promise<IntrusionCheck> {
  const evidence: string[] = [];

  if (!("Notification" in window)) {
    return {
      id: "push-perm",
      title: "Avisos que aparecem no celular",
      description: "Este navegador não permite essa verificação.",
      severity: "safe",
      details: "Nada a verificar.",
    };
  }

  const status = Notification.permission;
  evidence.push(`Situação neste site: ${status}`);

  // Push subscription details (se existir)
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        evidence.push(`Envio de avisos ativo: ${sub.endpoint.slice(0, 60)}…`);
      }
    }
  } catch {}

  let severity: Severity = "safe";
  let description = "Nenhum site está autorizado a te encher de avisos.";

  if (status === "granted") {
    severity = "warn";
    description =
      "Este site pode te enviar avisos. Confira a lista de sites autorizados no navegador.";
  }

  return {
    id: "push-perm",
    title: "Avisos que aparecem no celular",
    description,
    severity,
    details:
      "Golpistas pedem permissão para enviar avisos e depois mandam propaganda e links falsos. Em Configurações do navegador → Notificações, retire a permissão de sites que você não reconhece.",
    evidence,
  };
}

export async function runPackageBScan(): Promise<IntrusionCheck[]> {
  const [sw, push] = await Promise.all([
    checkRogueServiceWorkers(),
    checkPushPermissions(),
  ]);
  return [sw, push];
}
