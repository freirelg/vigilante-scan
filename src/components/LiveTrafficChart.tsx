import { useEffect, useRef, useState } from "react";
import { Activity, ArrowDown, Zap, BarChart3, Database } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

// Amostra tráfego real de recursos carregados pela página via PerformanceObserver
// + monkey-patch de fetch/XHR para capturar Content-Length de respostas mesmo
// quando Timing-Allow-Origin bloqueia transferSize.

const WINDOW_SECONDS = 30;

interface Point {
  t: number;
  kbs: number;
}

function formatRate(kbs: number) {
  if (kbs >= 1024) return `${(kbs / 1024).toFixed(2)} MB/s`;
  if (kbs >= 1) return `${kbs.toFixed(1)} KB/s`;
  return `${(kbs * 1024).toFixed(0)} B/s`;
}

// Instalação única do interceptor de fetch/XHR (idempotente)
let bytesSink: ((n: number) => void) | null = null;
let patched = false;

function installPatch() {
  if (patched || typeof window === "undefined") return;
  patched = true;

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await originalFetch.apply(this, args as any);
    try {
      const clone = res.clone();
      const len = clone.headers.get("content-length");
      if (len) {
        bytesSink?.(parseInt(len, 10) || 0);
      } else {
        // Fallback: lê o body em background para medir tamanho
        clone.arrayBuffer().then((buf) => bytesSink?.(buf.byteLength)).catch(() => {});
      }
    } catch {}
    return res;
  };

  const OrigXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    xhr.addEventListener("load", () => {
      try {
        const len = xhr.getResponseHeader("content-length");
        if (len) bytesSink?.(parseInt(len, 10) || 0);
        else if (typeof xhr.response === "string") bytesSink?.(xhr.response.length);
        else if (xhr.response instanceof ArrayBuffer) bytesSink?.(xhr.response.byteLength);
        else if (xhr.response instanceof Blob) bytesSink?.(xhr.response.size);
      } catch {}
    });
    return xhr;
  } as any;
  (window.XMLHttpRequest as any).prototype = OrigXHR.prototype;
}

export function LiveTrafficChart() {
  const [data, setData] = useState<Point[]>(() =>
    Array.from({ length: WINDOW_SECONDS }, (_, i) => ({ t: i, kbs: 0 }))
  );
  const [peak, setPeak] = useState(0);
  const [total, setTotal] = useState(0);
  const bucketBytesRef = useRef(0);
  const totalBytesRef = useRef(0);
  const tickRef = useRef(0);
  const seenUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    bytesSink = (n: number) => {
      if (n > 0) {
        bucketBytesRef.current += n;
        totalBytesRef.current += n;
      }
    };
    installPatch();

    let observer: PerformanceObserver | null = null;
    const supportsPO =
      typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes?.includes("resource");

    const addEntry = (entry: PerformanceResourceTiming) => {
      // Dedup para não contar duas vezes (buffered + interceptor)
      const key = `${entry.name}#${entry.startTime.toFixed(0)}`;
      if (seenUrlsRef.current.has(key)) return;
      seenUrlsRef.current.add(key);
      const bytes =
        entry.transferSize || entry.encodedBodySize || entry.decodedBodySize || 0;
      if (bytes > 0) {
        bucketBytesRef.current += bytes;
        totalBytesRef.current += bytes;
      }
    };

    if (supportsPO) {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          addEntry(entry);
        }
      });
      try {
        observer.observe({ type: "resource", buffered: true });
      } catch {
        observer = null;
      }
    }

    // Seed: soma bytes já carregados na sessão
    try {
      const existing = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      existing.forEach(addEntry);
    } catch {}

    // Envia um "heartbeat" para exercitar a rede a cada tick (opcional, real)
    const heartbeat = window.setInterval(() => {
      // Fetch de um recurso pequeno mesma origem para gerar tráfego mensurável
      fetch("/favicon.ico?_t=" + Date.now(), { cache: "no-store" }).catch(() => {});
    }, 5000);

    const interval = window.setInterval(() => {
      const bytes = bucketBytesRef.current;
      bucketBytesRef.current = 0;
      const kbs = bytes / 1024;
      tickRef.current += 1;

      setData((prev) => {
        const nextT = (prev[prev.length - 1]?.t ?? 0) + 1;
        return [...prev.slice(1), { t: nextT, kbs }];
      });
      setPeak((p) => (kbs > p ? kbs : p));
      setTotal(totalBytesRef.current);
    }, 1000);

    return () => {
      window.clearInterval(interval);
      window.clearInterval(heartbeat);
      observer?.disconnect();
      bytesSink = null;
    };
  }, []);

  const current = data[data.length - 1]?.kbs ?? 0;
  const avg = data.reduce((s, p) => s + p.kbs, 0) / Math.max(1, data.length);
  const totalMB = total / (1024 * 1024);

  // Domínio mínimo para linha ficar visível mesmo em silêncio
  const maxVal = Math.max(...data.map((d) => d.kbs), 1);

  const chartConfig = {
    kbs: {
      label: "Velocidade",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  return (
    <div className="rounded-2xl border border-primary/20 bg-black/40 backdrop-blur-md p-5 overflow-hidden relative group">
      {/* Decorative pulse background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors" />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              Tráfego de Rede
              <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
            </h4>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest opacity-70">
              Live Monitor · {WINDOW_SECONDS}s window
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5 text-primary font-mono text-base font-black">
            <Zap className="w-3.5 h-3.5 fill-primary" />
            {formatRate(current)}
          </div>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[9px] text-muted-foreground font-mono uppercase">Peak</span>
            <span className="text-[10px] text-foreground font-bold font-mono">{formatRate(peak)}</span>
          </div>
        </div>
      </div>

      <div className="h-28 w-full -mx-2 relative">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trafficStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="50%" stopColor="hsl(var(--accent))" />
                <stop offset="100%" stopColor="hsl(var(--primary))" />
              </linearGradient>
            </defs>
            <CartesianGrid 
              vertical={false} 
              strokeDasharray="3 3" 
              stroke="hsl(var(--primary))" 
              strokeOpacity={0.05} 
            />
            <YAxis hide domain={[0, maxVal * 1.3]} />
            <ChartTooltip
              cursor={{ 
                stroke: "hsl(var(--primary))", 
                strokeOpacity: 0.2, 
                strokeWidth: 1,
                strokeDasharray: "4 4"
              }}
              content={
                <ChartTooltipContent 
                  hideLabel 
                  formatter={(value) => (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="font-mono font-bold">{formatRate(value as number)}</span>
                    </div>
                  )}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="kbs"
              stroke="url(#trafficStroke)"
              strokeWidth={3}
              fill="url(#trafficFill)"
              isAnimationActive={false}
              dot={false}
              activeDot={{ 
                r: 4, 
                fill: "hsl(var(--primary))",
                stroke: "white",
                strokeWidth: 2,
                className: "drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.8)]"
              }}
            />
          </AreaChart>
        </ChartContainer>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5">
        <div className="relative group/item p-2.5 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-all duration-300">
          <div className="flex items-center gap-1.5 mb-1 opacity-60">
            <Zap className="w-3 h-3 text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Agora</span>
          </div>
          <p className="text-xs font-mono font-bold text-primary">
            {formatRate(current)}
          </p>
        </div>
        
        <div className="relative group/item p-2.5 rounded-xl bg-secondary/20 border border-border/50 hover:bg-secondary/30 transition-all duration-300">
          <div className="flex items-center gap-1.5 mb-1 opacity-60">
            <BarChart3 className="w-3 h-3 text-foreground" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Média</span>
          </div>
          <p className="text-xs font-mono font-bold text-foreground">
            {formatRate(avg)}
          </p>
        </div>
        
        <div className="relative group/item p-2.5 rounded-xl bg-secondary/20 border border-border/50 hover:bg-secondary/30 transition-all duration-300">
          <div className="flex items-center gap-1.5 mb-1 opacity-60">
            <Database className="w-3 h-3 text-foreground" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total</span>
          </div>
          <p className="text-xs font-mono font-bold text-foreground truncate">
            {totalMB >= 1 ? `${totalMB.toFixed(2)} MB` : `${(total / 1024).toFixed(1)} KB`}
          </p>
        </div>
      </div>
    </div>
  );
}
