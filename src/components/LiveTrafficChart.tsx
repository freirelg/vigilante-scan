import { useEffect, useRef, useState } from "react";
import { Activity, ArrowDown } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

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

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/15 text-primary">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">
              Tráfego de dados
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              últimos {WINDOW_SECONDS}s · ao vivo
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-primary font-mono text-sm font-bold">
            <ArrowDown className="w-3 h-3" />
            {formatRate(current)}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            pico {formatRate(peak)}
          </p>
        </div>
      </div>

      <div className="h-24 w-full -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="trafficStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="50%" stopColor="hsl(var(--accent))" />
                <stop offset="100%" stopColor="hsl(var(--primary))" />
              </linearGradient>
            </defs>
            <YAxis hide domain={[0, maxVal * 1.25]} />
            <Tooltip
              cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3, strokeWidth: 1 }}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
                padding: "4px 8px",
              }}
              labelFormatter={() => ""}
              formatter={(v: number) => [formatRate(v as number), "Velocidade"]}
            />
            <Area
              type="monotone"
              dataKey="kbs"
              stroke="url(#trafficStroke)"
              strokeWidth={2.5}
              fill="url(#trafficFill)"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 3, fill: "hsl(var(--primary))" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="rounded-lg bg-background/40 py-1.5">
          <p className="text-[10px] text-muted-foreground">Atual</p>
          <p className="text-xs font-mono font-semibold text-primary">
            {formatRate(current)}
          </p>
        </div>
        <div className="rounded-lg bg-background/40 py-1.5">
          <p className="text-[10px] text-muted-foreground">Média</p>
          <p className="text-xs font-mono font-semibold text-foreground">
            {formatRate(avg)}
          </p>
        </div>
        <div className="rounded-lg bg-background/40 py-1.5">
          <p className="text-[10px] text-muted-foreground">Sessão</p>
          <p className="text-xs font-mono font-semibold text-foreground">
            {totalMB >= 1 ? `${totalMB.toFixed(1)} MB` : `${(total / 1024).toFixed(1)} KB`}
          </p>
        </div>
      </div>
    </div>
  );
}
