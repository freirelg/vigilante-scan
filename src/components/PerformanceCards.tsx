import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Gauge, MousePointerClick, MoveVertical, FileWarning, Database, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  subscribeWebVitals, getResourceStats, rateLcp, rateCls, rateInp,
  type WebVitals, type ResourceStats,
} from "@/lib/perfSignals";
import { formatBytes } from "@/lib/deviceStorage";

const toneClass = (t: "good" | "warn" | "poor" | "na") =>
  t === "good"
    ? "text-success bg-success/10 border-success/30"
    : t === "warn"
    ? "text-warning bg-warning/10 border-warning/30"
    : t === "poor"
    ? "text-destructive bg-destructive/10 border-destructive/30"
    : "text-muted-foreground bg-muted/40 border-border";

const label = (t: "good" | "warn" | "poor" | "na") =>
  t === "good" ? "Bom" : t === "warn" ? "Atenção" : t === "poor" ? "Ruim" : "N/D";

export function PerformanceCards() {
  const [vitals, setVitals] = useState<WebVitals>({ lcp: null, cls: null, inp: null, fcp: null, ttfb: null });
  const [res, setRes] = useState<ResourceStats>({ total: 0, totalBytes: 0, cachedCount: 0, networkCount: 0, top: [] });

  useEffect(() => {
    const unsub = subscribeWebVitals(setVitals);
    setRes(getResourceStats(5));
    return unsub;
  }, []);

  const refresh = () => setRes(getResourceStats(5));

  const lcpT = rateLcp(vitals.lcp);
  const clsT = rateCls(vitals.cls);
  const inpT = rateInp(vitals.inp);

  const vitalItems = [
    { id: "lcp", label: "Abertura", full: "Tempo até a tela aparecer", value: vitals.lcp != null ? `${(vitals.lcp / 1000).toFixed(2)}s` : "…", tone: lcpT, icon: Gauge, hint: "até 2,5s é bom" },
    { id: "inp", label: "Resposta ao toque", full: "Tempo de resposta ao toque", value: vitals.inp != null ? `${vitals.inp} ms` : "…", tone: inpT, icon: MousePointerClick, hint: "até 200ms é bom" },
    { id: "cls", label: "Tela pulando", full: "Quanto a tela se mexe sozinha", value: vitals.cls != null ? vitals.cls.toFixed(3) : "…", tone: clsT, icon: MoveVertical, hint: "até 0,10 é bom" },
  ];

  return (
    <div className="space-y-3">
      {/* Web Vitals card */}
      <motion.div
        className="glass-card p-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Velocidade do app agora</h4>
          </div>
          <Badge variant="outline" className="text-[10px] border-success/40 text-success">AO VIVO</Badge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {vitalItems.map((v) => {
            const Icon = v.icon;
            return (
              <div key={v.id} className={`rounded-lg border p-3 ${toneClass(v.tone)}`}>
                <div className="flex items-center justify-between">
                  <Icon className="w-3.5 h-3.5 opacity-80" />
                  <span className="text-[10px] font-semibold">{label(v.tone)}</span>
                </div>
                <div className="text-lg font-bold tabular-nums mt-1">{v.value}</div>
                <div className="text-[10px] opacity-80">{v.label}</div>
                <div className="text-[9px] opacity-60 mt-0.5">{v.hint}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>Primeiro conteúdo: <span className="text-foreground tabular-nums">{vitals.fcp != null ? `${(vitals.fcp / 1000).toFixed(2)}s` : "—"}</span></span>
          <span>Resposta do servidor: <span className="text-foreground tabular-nums">{vitals.ttfb != null ? `${vitals.ttfb} ms` : "—"}</span></span>
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-2">
          Medido no seu aparelho enquanto você usa o app — os números se atualizam sozinhos.
        </p>
      </motion.div>

      {/* Heaviest resources card */}
      <motion.div
        className="glass-card p-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">O que mais pesa no app</h4>
          </div>
          <Button size="sm" variant="ghost" onClick={refresh} className="h-7 px-2 text-xs">
            <RefreshCw className="w-3 h-3 mr-1" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg border border-border bg-muted/30 p-2 text-center">
            <div className="text-lg font-bold tabular-nums text-foreground">{res.total}</div>
            <div className="text-[10px] text-muted-foreground">itens carregados</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-2 text-center">
            <div className="text-lg font-bold tabular-nums text-foreground">{formatBytes(res.totalBytes)}</div>
            <div className="text-[10px] text-muted-foreground">de dados usados</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-2 text-center">
            <div className="text-lg font-bold tabular-nums text-success flex items-center justify-center gap-1">
              <Database className="w-3.5 h-3.5" />
              {res.cachedCount}
            </div>
            <div className="text-[10px] text-muted-foreground">já guardados</div>
          </div>
        </div>

        {res.top.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            Não deu para medir o peso dos itens carregados agora.
          </p>
        ) : (
          <div className="space-y-1.5">
            {res.top.map((r, i) => {
              const pct = res.totalBytes > 0 ? (r.size / res.totalBytes) * 100 : 0;
              return (
                <div key={i} className="text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate flex-1 text-foreground" title={r.name}>
                      <span className="text-muted-foreground mr-1">#{i + 1}</span>
                      {r.short}
                    </span>
                    <Badge variant="outline" className="text-[9px] shrink-0">{r.type}</Badge>
                    <span className="tabular-nums text-muted-foreground shrink-0">{formatBytes(r.size)}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-3">
          Os 5 itens que mais consumiram dados desde que você abriu o app.
        </p>
      </motion.div>
    </div>
  );
}
