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
    { id: "lcp", label: "LCP", full: "Largest Contentful Paint", value: vitals.lcp != null ? `${(vitals.lcp / 1000).toFixed(2)}s` : "…", tone: lcpT, icon: Gauge, hint: "≤ 2.5s bom" },
    { id: "inp", label: "INP", full: "Interaction to Next Paint", value: vitals.inp != null ? `${vitals.inp} ms` : "…", tone: inpT, icon: MousePointerClick, hint: "≤ 200ms bom" },
    { id: "cls", label: "CLS", full: "Cumulative Layout Shift", value: vitals.cls != null ? vitals.cls.toFixed(3) : "…", tone: clsT, icon: MoveVertical, hint: "≤ 0.10 bom" },
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
            <h4 className="text-sm font-semibold text-foreground">Web Vitals ao vivo</h4>
          </div>
          <Badge variant="outline" className="text-[10px] border-success/40 text-success">REAL</Badge>
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
          <span>FCP: <span className="text-foreground tabular-nums">{vitals.fcp != null ? `${(vitals.fcp / 1000).toFixed(2)}s` : "—"}</span></span>
          <span>TTFB: <span className="text-foreground tabular-nums">{vitals.ttfb != null ? `${vitals.ttfb} ms` : "—"}</span></span>
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-2">
          Medido nesta sessão via <strong className="text-foreground">PerformanceObserver</strong> — atualiza automaticamente conforme você interage.
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
            <h4 className="text-sm font-semibold text-foreground">Recursos mais pesados</h4>
          </div>
          <Button size="sm" variant="ghost" onClick={refresh} className="h-7 px-2 text-xs">
            <RefreshCw className="w-3 h-3 mr-1" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg border border-border bg-muted/30 p-2 text-center">
            <div className="text-lg font-bold tabular-nums text-foreground">{res.total}</div>
            <div className="text-[10px] text-muted-foreground">requisições</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-2 text-center">
            <div className="text-lg font-bold tabular-nums text-foreground">{formatBytes(res.totalBytes)}</div>
            <div className="text-[10px] text-muted-foreground">transferidos</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-2 text-center">
            <div className="text-lg font-bold tabular-nums text-success flex items-center justify-center gap-1">
              <Database className="w-3.5 h-3.5" />
              {res.cachedCount}
            </div>
            <div className="text-[10px] text-muted-foreground">em cache</div>
          </div>
        </div>

        {res.top.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            Nenhum recurso com peso mensurável (headers `Timing-Allow-Origin` podem estar ausentes).
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
          Fonte: <strong className="text-foreground">performance.getEntriesByType("resource")</strong> — top 5 por bytes transferidos nesta sessão.
        </p>
      </motion.div>
    </div>
  );
}
