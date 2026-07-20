import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  History,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { getScanHistory, clearScanHistory, ScanRecord } from "@/lib/scanHistory";

function gradeStyle(grade: ScanRecord["grade"]) {
  switch (grade) {
    case "Excelente":
      return { color: "text-success", Icon: ShieldCheck };
    case "Bom":
      return { color: "text-primary", Icon: ShieldCheck };
    case "Atenção":
      return { color: "text-warning", Icon: ShieldAlert };
    case "Crítico":
      return { color: "text-destructive", Icon: ShieldX };
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScanHistory() {
  const [history, setHistory] = useState<ScanRecord[]>([]);

  const refresh = () => setHistory(getScanHistory());

  useEffect(() => {
    refresh();
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("scan-history-updated", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("scan-history-updated", onStorage);
    };
  }, []);

  if (history.length === 0) {
    return (
      <Card className="p-8 bg-card border-border text-center">
        <History className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold text-foreground mb-1">
          Nenhum scan registrado
        </h3>
        <p className="text-sm text-muted-foreground">
          Rode uma análise na aba Score para começar a acompanhar a evolução do
          aparelho.
        </p>
      </Card>
    );
  }

  const chartData = [...history]
    .slice()
    .reverse()
    .map((r, i) => ({
      idx: i + 1,
      score: r.score,
      label: formatDate(r.date),
    }));

  const latest = history[0];
  const previous = history[1];
  const diff = previous ? latest.score - previous.score : 0;
  const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const trendColor =
    diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground";

  const avg = Math.round(
    history.reduce((s, r) => s + r.score, 0) / history.length
  );
  const best = Math.max(...history.map((r) => r.score));

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 bg-card border-border">
          <div className="text-xs text-muted-foreground">Último</div>
          <div className="text-2xl font-bold text-foreground">{latest.score}</div>
          <div className={`flex items-center gap-1 text-xs mt-1 ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            {diff > 0 ? `+${diff}` : diff}
          </div>
        </Card>
        <Card className="p-3 bg-card border-border">
          <div className="text-xs text-muted-foreground">Média</div>
          <div className="text-2xl font-bold text-foreground">{avg}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {history.length} scan(s)
          </div>
        </Card>
        <Card className="p-3 bg-card border-border">
          <div className="text-xs text-muted-foreground">Melhor</div>
          <div className="text-2xl font-bold text-success">{best}</div>
          <div className="text-xs text-muted-foreground mt-1">recorde</div>
        </Card>
      </div>

      {/* Evolution chart */}
      <Card className="p-4 bg-card border-border">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Evolução do score
          </h3>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="idx"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.label ?? ""
                }
                formatter={(v: number) => [`${v}`, "Score"]}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Histórico de scans
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive gap-1"
            onClick={() => {
              clearScanHistory();
              refresh();
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar
          </Button>
        </div>

        {history.map((r, i) => {
          const { color, Icon } = gradeStyle(r.grade);
          const prev = history[i + 1];
          const d = prev ? r.score - prev.score : 0;
          const DIcon = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
          const dColor =
            d > 0 ? "text-success" : d < 0 ? "text-destructive" : "text-muted-foreground";
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="p-3 bg-card border-border">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted/40 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {formatDate(r.date)}
                    </div>
                    <div className={`text-sm font-semibold ${color}`}>
                      {r.grade}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-foreground">
                      {r.score}
                    </div>
                    {prev && (
                      <div className={`flex items-center justify-end gap-0.5 text-xs ${dColor}`}>
                        <DIcon className="w-3 h-3" />
                        {d > 0 ? `+${d}` : d}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
