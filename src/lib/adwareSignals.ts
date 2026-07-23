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
      title: "Service Workers Estranhos",
      description: "API de Service Worker indisponível neste navegador.",
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
        title: "Service Workers Estranhos",
        description: `⚠️ ${suspicious.length} Service Worker(s) desconhecido(s) registrado(s).`,
        severity: "danger",
        details:
          "Service Workers podem interceptar requests e servir conteúdo malicioso mesmo offline. Se você não reconhece, desregistre em Configurações do site → Service Workers.",
        evidence,
      };
    }

    return {
      id: "rogue-sw",
      title: "Service Workers Estranhos",
      description:
        regs.length === 0
          ? "Nenhum Service Worker registrado."
          : `${regs.length} Service Worker(s) legítimo(s) ativo(s).`,
      severity: "safe",
      details: "Todos os SWs pertencem à origem atual e estão em caminhos conhecidos.",
      evidence,
    };
  } catch (err) {
    return {
      id: "rogue-sw",
      title: "Service Workers Estranhos",
      description: "Erro ao consultar Service Workers.",
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
      title: "Notificações Push",
      description: "API de notificações indisponível.",
      severity: "safe",
      details: "Nada a verificar.",
    };
  }

  const status = Notification.permission;
  evidence.push(`Permissão nesta origem: ${status}`);

  // Push subscription details (se existir)
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        evidence.push(`Endpoint push ativo: ${sub.endpoint.slice(0, 60)}…`);
      }
    }
  } catch {}

  let severity: Severity = "safe";
  let description = "Permissões de notificação estão saudáveis.";

  if (status === "granted") {
    severity = "warn";
    description =
      "Esta origem tem permissão para push. Revise todos os sites com permissão no navegador.";
  }

  return {
    id: "push-perm",
    title: "Notificações Push",
    description,
    severity,
    details:
      "Adware clássico pede permissão de push e depois envia anúncios/phishing. Verifique em chrome://settings/content/notifications (ou Configurações → Notificações no Firefox/Safari) e revogue sites que você não reconhece.",
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
