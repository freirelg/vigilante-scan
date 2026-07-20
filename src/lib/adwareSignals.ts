// Package B: Adware / Cryptojacking detection
// - Rogue Service Workers registered on this origin
// - Push notification permissions granted
// - CPU timing analysis to detect hidden miners

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

// -------- 8. Timing / Miner detection --------
// Mede tempo de operações crypto conhecidas. Se anormalmente lento
// para o hardware disponível → CPU sendo consumida por outra coisa
// (minerador, RAT, extensão pesada).
export async function checkCpuTiming(): Promise<IntrusionCheck> {
  const evidence: string[] = [];

  // Baseline: N hashes SHA-256 sobre buffer de 1KB
  const iterations = 400;
  const data = new Uint8Array(1024);
  crypto.getRandomValues(data);

  const runs: number[] = [];
  for (let r = 0; r < 3; r++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await crypto.subtle.digest("SHA-256", data);
    }
    runs.push(performance.now() - start);
  }
  const avg = runs.reduce((a, b) => a + b, 0) / runs.length;
  const perOp = avg / iterations;

  const cores = navigator.hardwareConcurrency || 4;
  evidence.push(`Média: ${avg.toFixed(1)}ms para ${iterations} hashes SHA-256`);
  evidence.push(`Por operação: ${perOp.toFixed(3)}ms`);
  evidence.push(`CPU cores: ${cores}`);

  // Variância entre runs — miner causa jitter alto
  const max = Math.max(...runs);
  const min = Math.min(...runs);
  const jitter = ((max - min) / avg) * 100;
  evidence.push(`Variação entre runs: ${jitter.toFixed(1)}%`);

  // Heap memory se disponível
  // @ts-ignore
  const mem = (performance as any).memory;
  if (mem) {
    const usedMB = (mem.usedJSHeapSize / 1048576).toFixed(1);
    const limitMB = (mem.jsHeapSizeLimit / 1048576).toFixed(0);
    const pct = (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;
    evidence.push(`Heap JS: ${usedMB}MB / ${limitMB}MB (${pct.toFixed(1)}%)`);
  }

  // Thresholds empíricos: em hardware moderno, SHA-256 de 1KB roda em <0.1ms
  // >0.5ms/op indica CPU comprometida; jitter >50% indica contenção
  let severity: Severity = "safe";
  let description = "Performance de CPU dentro do esperado.";

  if (perOp > 0.8 || jitter > 80) {
    severity = "danger";
    description =
      "⚠️ CPU anormalmente lenta ou instável. Possível minerador/RAT consumindo recursos em segundo plano.";
  } else if (perOp > 0.4 || jitter > 40) {
    severity = "warn";
    description = "CPU sob carga moderada — outras abas/extensões podem estar consumindo recursos.";
  }

  if (mem && mem.usedJSHeapSize / mem.jsHeapSizeLimit > 0.85) {
    severity = severity === "safe" ? "warn" : severity;
    description += " Uso de heap acima de 85%.";
  }

  return {
    id: "cpu-timing",
    title: "Análise de CPU (Miner/RAT)",
    description,
    severity,
    details:
      "Executa hashes SHA-256 em loop e mede o tempo. Mineradores cripto e RATs disputam CPU e produzem tempos anormalmente altos ou instáveis. Feche outras abas pesadas antes de reexecutar.",
    evidence,
  };
}

export async function runPackageBScan(): Promise<IntrusionCheck[]> {
  const [sw, push, cpu] = await Promise.all([
    checkRogueServiceWorkers(),
    checkPushPermissions(),
    checkCpuTiming(),
  ]);
  return [sw, push, cpu];
}
