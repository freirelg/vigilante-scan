import { useEffect, useRef, useState } from "react";
import { Activity, ArrowDown } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

// Amostra tráfego real de recursos carregados pela página via PerformanceObserver.
// Mostra KB/s dos últimos ~30 s em um gráfico de linha/área suave.

const WINDOW_SECONDS = 30;

interface Point {
  t: number;   // segundo (índice)
  kbs: number; // KB/s naquele bucket
}

function formatRate(kbs: number) {
  if (kbs >= 1024) return `${(kbs / 1024).toFixed(2)} MB/s`;
  return `${kbs.toFixed(1)} KB/s`;
}

export function LiveTrafficChart() {
  const [data, setData] = useState<Point[]>(() =>
    Array.from({ length: WINDOW_SECONDS }, (_, i) => ({ t: i, kbs: 0 }))
  );
  const [peak, setPeak] = useState(0);
  const [total, setTotal] = useState(0); // bytes acumulados na janela
  const bucketBytesRef = useRef(0);
  const totalBytesRef = useRef(0);

  useEffect(() => {
    let observer: PerformanceObserver | null = null;
    const supportsPO =
      typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes?.includes("resource");

    if (supportsPO) {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          // transferSize inclui overhead HTTP; 0 se veio do cache
          const bytes = entry.transferSize || entry.encodedBodySize || 0;
          if (bytes > 0) {
            bucketBytesRef.current += bytes;
            totalBytesRef.current += bytes;
          }
        }
      });
      try {
        observer.observe({ type: "resource", buffered: false });
      } catch {
        observer = null;
      }
    }

    // Tick de 1 s: consolida o bucket em um ponto do gráfico
    const interval = window.setInterval(() => {
      const bytes = bucketBytesRef.current;
      bucketBytesRef.current = 0;
      const kbs = bytes / 1024;

      setData((prev) => {
        const next = [...prev.slice(1), { t: prev[prev.length - 1].t + 1, kbs }];
        return next;
      });
      setPeak((p) => (kbs > p ? kbs : p));
      setTotal(totalBytesRef.current);
    }, 1000);

    return () => {
      window.clearInterval(interval);
      observer?.disconnect();
    };
  }, []);

  const current = data[data.length - 1]?.kbs ?? 0;
  const avg =
    data.reduce((s, p) => s + p.kbs, 0) / Math.max(1, data.length);
  const totalMB = total / (1024 * 1024);

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/15 text-primary">
            <Activity className="w-4 h-4" />
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
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="trafficStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="50%" stopColor="hsl(var(--accent))" />
                <stop offset="100%" stopColor="hsl(var(--primary))" />
              </linearGradient>
            </defs>
            <YAxis hide domain={[0, (dataMax: number) => Math.max(2, dataMax * 1.2)]} />
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
              formatter={(v: number) => [formatRate(v), "Velocidade"]}
            />
            <Area
              type="monotone"
              dataKey="kbs"
              stroke="url(#trafficStroke)"
              strokeWidth={2}
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
            {totalMB >= 1 ? `${totalMB.toFixed(1)} MB` : `${(total / 1024).toFixed(0)} KB`}
          </p>
        </div>
      </div>
    </div>
  );
}
