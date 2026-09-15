import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Server, Activity, RefreshCw, AlertTriangle, CheckCircle2, Cpu, PowerOff, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getSwHealth, forceSwUpdate, unregisterSw,
  getMemoryPressure,
  type SwHealth, type MemoryPressure,
} from "@/lib/healthSignals";
import { formatBytes } from "@/lib/deviceStorage";

export function HealthPressureCards() {
  const [sw, setSw] = useState<SwHealth | null>(null);
  const [mem, setMem] = useState<MemoryPressure | null>(null);
  const [busy, setBusy] = useState<"update" | "unregister" | null>(null);

  const refresh = useCallback(async () => {
    setSw(await getSwHealth());
    setMem(getMemoryPressure());
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(() => setMem(getMemoryPressure()), 3000);
    const onCtrl = () => refresh();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onCtrl);
    }
    return () => {
      clearInterval(id);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", onCtrl);
      }
    };
  }, [refresh]);

  const onUpdate = async () => {
    setBusy("update");
    const r = await forceSwUpdate();
    setBusy(null);
    if (!r.ok) toast.error("Não há nada para atualizar agora");
    else if (r.hadWaiting) toast.success("Nova versão pronta — recarregue para usar");
    else toast.success("Tudo já está na versão mais recente");
    refresh();
  };

  const onUnregister = async () => {
    setBusy("unregister");
    const ok = await unregisterSw();
    setBusy(null);
    if (ok) toast.success("Proteção em segundo plano desligada");
    else toast.error("Não foi possível desligar");
    refresh();
  };

  const swTone: "success" | "warning" | "destructive" =
    !sw?.registered ? "warning"
    : sw.stuck ? "destructive"
    : sw.hasWaiting ? "warning"
    : sw.hasController ? "success"
    : "warning";

  const tone = (t: "success" | "warning" | "destructive") =>
    t === "success" ? "text-success bg-success/10 border-success/30"
    : t === "warning" ? "text-warning bg-warning/10 border-warning/30"
    : "text-destructive bg-destructive/10 border-destructive/30";

  const swLabel =
    !sw?.supported ? "Não disponível"
    : !sw.registered ? "Desligada"
    : sw.stuck ? "Travada"
    : sw.hasWaiting ? "Atualização pendente"
    : sw.hasController ? "Ativa"
    : "Ainda iniciando";

  // ---- Memory ----
  const memTone: "success" | "warning" | "destructive" =
    !mem?.supported ? "warning"
    : mem.level === "crit" ? "destructive"
    : mem.level === "warn" ? "warning"
    : "success";

  const memLabel =
    !mem?.supported ? "N/D"
    : mem.level === "crit" ? "Crítica"
    : mem.level === "warn" ? "Alta"
    : "Saudável";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* SERVICE WORKER */}
      <motion.div
        className="glass-card p-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className={`p-2 rounded-lg border ${tone(swTone)}`}>
            <Server className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">Proteção em segundo plano</p>
              <Badge variant="outline" className={`text-[10px] ${tone(swTone)}`}>
                {swLabel}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground/80 mt-1 truncate">
              {sw?.scriptUrl ? new URL(sw.scriptUrl).pathname : "Nada rodando agora"}
            </p>
          </div>
        </div>

        {sw?.supported && (
          <div className="grid grid-cols-2 gap-1.5 text-[11px] mb-3">
            <Row label="Área" value={sw.scope ? new URL(sw.scope).pathname : "—"} />
            <Row label="Situação" value={sw.state ?? "—"} />
            <Row label="No comando" value={sw.hasController ? "sim" : "não"} good={sw.hasController} />
            <Row label="Aguardando" value={sw.hasWaiting ? "sim" : "não"} bad={sw.hasWaiting} />
            <Row label="Instalando" value={sw.hasInstalling ? "sim" : "não"} />
            <Row label="Dados salvos" value={sw.updateViaCache ?? "—"} />
          </div>
        )}

        {sw?.stuck && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
            <p className="text-[11px] text-destructive">{sw.stuckReason}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onUpdate}
            disabled={busy !== null || !sw?.supported}
          >
            {busy === "update" ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            Atualizar agora
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={onUnregister}
            disabled={busy !== null || !sw?.registered}
          >
            {busy === "unregister" ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <PowerOff className="w-3.5 h-3.5" />
            )}
            Desligar
          </Button>
        </div>
      </motion.div>

      {/* MEMORY PRESSURE */}
      <motion.div
        className="glass-card p-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className={`p-2 rounded-lg border ${tone(memTone)}`}>
            <Activity className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">Uso de memória</p>
              <Badge variant="outline" className={`text-[10px] ${tone(memTone)}`}>
                {memLabel} {mem?.usagePct != null ? `• ${mem.usagePct.toFixed(0)}%` : ""}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground/80 mt-1">
              Memória que o app está usando agora. Atualiza a cada 3 segundos.
            </p>
          </div>
        </div>

        {mem?.supported ? (
          <>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
              <motion.div
                className={
                  memTone === "success" ? "h-full bg-success"
                  : memTone === "warning" ? "h-full bg-warning"
                  : "h-full bg-destructive"
                }
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(mem.usagePct ?? 0, 100)}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <Row label="Usado" value={formatBytes(mem.usedBytes ?? 0)} />
              <Row label="Reservado" value={formatBytes(mem.totalBytes ?? 0)} />
              <Row label="Limite" value={formatBytes(mem.limitBytes ?? 0)} />
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
            Este navegador não informa o uso de memória do app.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {mem?.deviceMemoryGb != null && (
            <Badge variant="outline" className="text-[10px]">
              <Cpu className="w-3 h-3 mr-1" /> {mem.deviceMemoryGb} GB RAM
            </Badge>
          )}
          {mem?.hardwareConcurrency != null && (
            <Badge variant="outline" className="text-[10px]">
              {mem.hardwareConcurrency} núcleos
            </Badge>
          )}
          {mem?.wasDiscarded ? (
            <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">
              <AlertTriangle className="w-3 h-3 mr-1" /> App já foi fechado por falta de memória
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] border-success/40 text-success">
              <CheckCircle2 className="w-3 h-3 mr-1" /> App rodando sem interrupções
            </Badge>
          )}
        </div>

        {mem?.level === "crit" && (
          <p className="text-[11px] text-destructive mt-2">
            ⚠ Memória quase no limite — o app pode fechar sozinho. Feche outras abas ou recarregue.
          </p>
        )}
        {mem?.level === "warn" && (
          <p className="text-[11px] text-warning mt-2">
            Memória alta — vale recarregar o app para liberar espaço.
          </p>
        )}
      </motion.div>
    </div>
  );
}

function Row({
  label, value, good, bad,
}: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="flex items-center justify-between bg-muted/30 rounded px-2 py-1 border border-border/30">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          "font-mono tabular-nums truncate ml-2 " +
          (bad ? "text-destructive" : good ? "text-success" : "text-foreground")
        }
      >
        {value}
      </span>
    </div>
  );
}
