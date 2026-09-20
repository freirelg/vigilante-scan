import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, ShieldQuestion, RefreshCw, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { detectProtections, type Protection, type State } from "@/components/DeviceProtections";
import { toast } from "sonner";

// Caminho de ajuste dentro do celular + página de ajuda oficial
const HOW_TO: Record<string, { path: string; help: string }> = {
  secure: {
    path: "Navegador → Configurações → Privacidade e segurança → Usar sempre conexão segura",
    help: "https://support.google.com/chrome/answer/10468685?hl=pt-BR",
  },
  notrack: {
    path: "Navegador → Configurações → Privacidade e segurança → Enviar pedido de 'não me rastreie'",
    help: "https://support.google.com/chrome/answer/2790761?hl=pt-BR",
  },
  cookies: {
    path: "Navegador → Configurações → Privacidade e segurança → Bloquear quem te segue entre sites",
    help: "https://support.google.com/chrome/answer/95647?hl=pt-BR",
  },
  popup: {
    path: "Navegador → Configurações → Configurações do site → Janelas que abrem sozinhas",
    help: "https://support.google.com/chrome/answer/95472?hl=pt-BR",
  },
  guard: {
    path: "Menu do navegador → Adicionar à tela inicial (instalar o app)",
    help: "https://support.google.com/chrome/answer/9658361?hl=pt-BR",
  },
  isolated: {
    path: "Feche abas que você não reconhece enquanto usa o app",
    help: "https://support.google.com/chrome/answer/9845731?hl=pt-BR",
  },
};

export function ProtectionsScreen() {
  const [items, setItems] = useState<Protection[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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
  const pending = (items ?? []).filter((i) => i.state !== "on");
  const active = (items ?? []).filter((i) => i.state === "on");

  const tone = (s: State) =>
    s === "on"
      ? "text-success bg-success/10 border-success/30"
      : s === "off"
      ? "text-destructive bg-destructive/10 border-destructive/30"
      : "text-warning bg-warning/10 border-warning/30";

  const copyPath = async (id: string) => {
    const path = HOW_TO[id]?.path;
    if (!path) return;
    try {
      await navigator.clipboard.writeText(path);
      setCopied(id);
      toast.success("Caminho copiado");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const card = (p: Protection) => (
    <div key={p.id} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
      <div className="flex items-start gap-3">
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
            <>
              <p className="text-[11px] text-muted-foreground/80 mt-1 flex items-start gap-1">
                {p.state === "off" ? (
                  <ShieldAlert className="w-3 h-3 mt-0.5 text-destructive flex-shrink-0" />
                ) : (
                  <ShieldQuestion className="w-3 h-3 mt-0.5 text-warning flex-shrink-0" />
                )}
                {p.tip}
              </p>
              {HOW_TO[p.id] && (
                <>
                  <p className="text-[11px] text-foreground/80 mt-2 bg-background/50 border border-border/50 rounded-md p-2">
                    {HOW_TO[p.id].path}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => copyPath(p.id)}>
                      {copied === p.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      Copiar caminho
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" asChild>
                      <a href={HOW_TO[p.id].help} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3" />
                        Ver como fazer
                      </a>
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl gradient-primary glow-primary">
              <ShieldCheck className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Proteções ativas</h3>
              <p className="text-sm text-muted-foreground">O que já está te defendendo neste celular</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary tabular-nums">
              {on}/{total}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ativas</div>
          </div>
        </div>

        <Button variant="outline" className="w-full mt-4" onClick={run} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Verificar novamente
        </Button>
      </motion.div>

      {pending.length > 0 && (
        <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h4 className="text-sm font-semibold text-foreground mb-3">Precisa de ajuste ({pending.length})</h4>
          <div className="space-y-2">{pending.map(card)}</div>
        </motion.div>
      )}

      {active.length > 0 && (
        <motion.div className="glass-card p-5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h4 className="text-sm font-semibold text-foreground mb-3">Já protegido ({active.length})</h4>
          <div className="space-y-2">{active.map(card)}</div>
        </motion.div>
      )}

      {!items && <p className="text-sm text-muted-foreground">Verificando proteções...</p>}
    </div>
  );
}
