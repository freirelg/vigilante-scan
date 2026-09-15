import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, ShieldQuestion, RefreshCw, Lock, EyeOff, Cookie, Ban, Fingerprint, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type State = "on" | "off" | "unknown";

interface Protection {
  id: string;
  name: string;
  icon: React.ReactNode;
  state: State;
  detail: string;
  tip: string;
}

async function detectProtections(): Promise<Protection[]> {
  const nav = navigator as Navigator & {
    globalPrivacyControl?: boolean;
    cookieDeprecationLabel?: { getValue: () => Promise<string> };
  };

  // Conexão protegida
  const secure = window.isSecureContext && window.location.protocol === "https:";

  // Pedido de "não me rastreie"
  const noTrack = nav.doNotTrack === "1" || nav.globalPrivacyControl === true;

  // Bloqueio de sites que te seguem pela internet
  let thirdParty: State = "unknown";
  try {
    const d = document as Document & { hasStorageAccess?: () => Promise<boolean> };
    if (nav.cookieDeprecationLabel?.getValue) {
      const label = await nav.cookieDeprecationLabel.getValue();
      if (label) thirdParty = "on";
    }
    if (thirdParty === "unknown" && typeof d.hasStorageAccess === "function") {
      thirdParty = (await d.hasStorageAccess()) ? "off" : "on";
    }
  } catch {
    thirdParty = "unknown";
  }

  // Guarda de janelas indesejadas (bloqueio de pop-up)
  let popupBlocked: State = "unknown";
  try {
    const w = window.open("", "_blank", "width=1,height=1");
    if (!w) popupBlocked = "on";
    else {
      w.close();
      popupBlocked = "off";
    }
  } catch {
    popupBlocked = "on";
  }

  // Camada de proteção do app rodando em segundo plano
  let guard: State = "unknown";
  try {
    guard = "serviceWorker" in navigator && (await navigator.serviceWorker.getRegistration()) ? "on" : "off";
  } catch {
    guard = "unknown";
  }

  // Isolamento contra espionagem entre abas
  const isolated = (window as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;

  return [
    {
      id: "secure",
      name: "Conexão protegida",
      icon: <Lock className="w-4 h-4" />,
      state: secure ? "on" : "off",
      detail: secure ? "Seus dados viajam embaralhados" : "Conexão aberta, dá para espiar",
      tip: "Evite usar o app em endereços que não começam com https.",
    },
    {
      id: "notrack",
      name: "Pedido de não ser rastreado",
      icon: <EyeOff className="w-4 h-4" />,
      state: noTrack ? "on" : "off",
      detail: noTrack ? "Seu celular pede para não te seguirem" : "Seu celular não faz esse pedido",
      tip: "Ative a opção de privacidade no seu navegador para reduzir rastreamento.",
    },
    {
      id: "cookies",
      name: "Bloqueio de quem te segue",
      icon: <Cookie className="w-4 h-4" />,
      state: thirdParty,
      detail:
        thirdParty === "on"
          ? "Sites de fora estão bloqueados"
          : thirdParty === "off"
          ? "Sites de fora conseguem te acompanhar"
          : "Não deu para confirmar neste navegador",
      tip: "No navegador, ative o bloqueio de rastreadores de outros sites.",
    },
    {
      id: "popup",
      name: "Guarda de janelas indesejadas",
      icon: <Ban className="w-4 h-4" />,
      state: popupBlocked,
      detail: popupBlocked === "on" ? "Janelas surpresa são barradas" : "Janelas surpresa podem abrir",
      tip: "Mantenha o bloqueio de janelas ligado nas configurações do navegador.",
    },
    {
      id: "guard",
      name: "Proteção do app em segundo plano",
      icon: <Smartphone className="w-4 h-4" />,
      state: guard,
      detail: guard === "on" ? "Ativa e vigiando o app" : "Ainda não ativada neste aparelho",
      tip: "Instale o app na tela inicial para manter essa proteção ligada.",
    },
    {
      id: "isolated",
      name: "Isolamento entre abas",
      icon: <Fingerprint className="w-4 h-4" />,
      state: isolated ? "on" : "unknown",
      detail: isolated ? "Outras abas não enxergam este app" : "Proteção padrão do navegador",
      tip: "Feche abas desconhecidas enquanto usa apps sensíveis.",
    },
  ];
}

export function DeviceProtections() {
  const [items, setItems] = useState<Protection[] | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setItems(await detectProtections());
    setLoading(false);
  };

  useEffect(() => {
    run();
  }, []);

  const on = items?.filter((i) => i.state === "on").length ?? 0;
  const total = items?.length ?? 0;

  const tone = (s: State) =>
    s === "on"
      ? "text-success bg-success/10 border-success/30"
      : s === "off"
      ? "text-destructive bg-destructive/10 border-destructive/30"
      : "text-warning bg-warning/10 border-warning/30";

  return (
    <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl gradient-primary glow-primary">
            <ShieldCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Proteções do seu aparelho</h3>
            <p className="text-sm text-muted-foreground">O que já está te defendendo agora</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary tabular-nums">
            {on}/{total}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ativas</div>
        </div>
      </div>

      <div className="space-y-2">
        {(items ?? []).map((p) => (
          <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className={`p-2 rounded-lg border ${tone(p.state)}`}>{p.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <Badge variant="outline" className={`text-[10px] ${tone(p.state)}`}>
                  {p.state === "on" ? "Ativa" : p.state === "off" ? "Desligada" : "Indefinida"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{p.detail}</p>
              {p.state !== "on" && (
                <p className="text-[11px] text-muted-foreground/80 mt-1 flex items-start gap-1">
                  {p.state === "off" ? (
                    <ShieldAlert className="w-3 h-3 mt-0.5 text-destructive flex-shrink-0" />
                  ) : (
                    <ShieldQuestion className="w-3 h-3 mt-0.5 text-warning flex-shrink-0" />
                  )}
                  {p.tip}
                </p>
              )}
            </div>
          </div>
        ))}
        {!items && <p className="text-sm text-muted-foreground">Verificando proteções...</p>}
      </div>

      <Button variant="outline" className="w-full mt-4" onClick={run} disabled={loading}>
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        Verificar novamente
      </Button>
    </motion.div>
  );
}
