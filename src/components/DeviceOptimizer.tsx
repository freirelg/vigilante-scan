import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cpu, HardDrive, Trash2, Zap, RefreshCw, CheckCircle, Database, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getStorageInfo, getCacheInfo, getMemoryInfo, clearAllCaches, formatBytes,
  type StorageInfo, type CacheInfo, type MemoryInfo,
} from "@/lib/deviceStorage";

interface MetricRow {
  id: string;
  name: string;
  icon: React.ReactNode;
  used: number;
  total: number;
  usedLabel: string;
  totalLabel: string;
  percentage: number;
  supported: boolean;
  note?: string;
}

export function DeviceOptimizer() {
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [cache, setCache] = useState<CacheInfo | null>(null);
  const [memory, setMemory] = useState<MemoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [freedBytes, setFreedBytes] = useState(0);

  const refresh = async () => {
    setLoading(true);
    const [s, c] = await Promise.all([getStorageInfo(), getCacheInfo()]);
    setStorage(s);
    setCache(c);
    setMemory(getMemoryInfo());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const optimize = async () => {
    if (!cache) return;
    setOptimizing(true);
    let freed = 0;
    try {
      const before = cache.cacheSize;
      const removed = await clearAllCaches();
      freed += before;
      // Also try to clear localStorage of non-critical keys? Skip to preserve app state.
      setFreedBytes((prev) => prev + freed);
      toast.success(`${removed} cache(s) limpos — ${formatBytes(freed)} liberados`);
      await refresh();
    } catch {
      toast.error("Falha ao limpar caches");
    } finally {
      setOptimizing(false);
    }
  };

  const requestPersistent = async () => {
    if (!navigator.storage?.persist) {
      toast.error("Não suportado neste navegador");
      return;
    }
    const granted = await navigator.storage.persist();
    if (granted) toast.success("Armazenamento marcado como persistente");
    else toast.warning("Navegador não concedeu persistência");
  };

  const metrics: MetricRow[] = [
    {
      id: "storage",
      name: "Armazenamento do App",
      icon: <HardDrive className="w-5 h-5" />,
      used: storage?.usage ?? 0,
      total: storage?.quota ?? 0,
      usedLabel: storage ? formatBytes(storage.usage) : "—",
      totalLabel: storage ? formatBytes(storage.quota) : "—",
      percentage: storage?.usagePct ?? 0,
      supported: storage?.supported ?? false,
      note: "Quota real disponibilizada pelo navegador ao app",
    },
    {
      id: "cache",
      name: "Cache do Service Worker",
      icon: <Trash2 className="w-5 h-5" />,
      used: cache?.cacheSize ?? 0,
      total: storage?.quota ?? 0,
      usedLabel: cache ? formatBytes(cache.cacheSize) : "—",
      totalLabel: `${cache?.cacheCount ?? 0} cache(s)`,
      percentage: storage?.quota ? ((cache?.cacheSize ?? 0) / storage.quota) * 100 : 0,
      supported: true,
      note: "Pode ser limpo com segurança",
    },
    {
      id: "ls",
      name: "LocalStorage",
      icon: <Database className="w-5 h-5" />,
      used: cache?.localStorageSize ?? 0,
      total: 5 * 1024 * 1024, // ~5MB típico
      usedLabel: cache ? formatBytes(cache.localStorageSize) : "—",
      totalLabel: "~5 MB",
      percentage: cache ? ((cache.localStorageSize) / (5 * 1024 * 1024)) * 100 : 0,
      supported: true,
      note: `${cache?.indexedDbCount ?? 0} base(s) IndexedDB`,
    },
  ];

  if (memory?.deviceMemoryGb || memory?.jsHeapUsed) {
    metrics.unshift({
      id: "ram",
      name: memory.deviceMemoryGb ? "Memória do Dispositivo" : "Heap JavaScript",
      icon: <Cpu className="w-5 h-5" />,
      used: memory.jsHeapUsed ?? 0,
      total: memory.jsHeapLimit ?? (memory.deviceMemoryGb ?? 0) * 1024 * 1024 * 1024,
      usedLabel: memory.jsHeapUsed ? formatBytes(memory.jsHeapUsed) : `${memory.deviceMemoryGb} GB`,
      totalLabel: memory.deviceMemoryGb ? `${memory.deviceMemoryGb} GB total` : formatBytes(memory.jsHeapLimit ?? 0),
      percentage: memory.jsHeapUsed && memory.jsHeapLimit ? (memory.jsHeapUsed / memory.jsHeapLimit) * 100 : 0,
      supported: true,
      note: memory.deviceMemoryGb ? "Aproximado (Device Memory API)" : "Heap JS (Chrome)",
    });
  }

  const getUsageColor = (pct: number) =>
    pct > 80 ? "bg-destructive" : pct > 60 ? "bg-warning" : "bg-success";

  return (
    <div className="space-y-6">
      {/* Summary */}
      <motion.div
        className="glass-card p-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
            freedBytes > 0 ? "gradient-success glow-success" : "gradient-primary glow-primary"
          }`}
          animate={optimizing ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5, repeat: optimizing ? Infinity : 0 }}
        >
          {freedBytes > 0 ? (
            <CheckCircle className="w-10 h-10 text-success-foreground" />
          ) : (
            <Zap className="w-10 h-10 text-primary-foreground" />
          )}
        </motion.div>

        {freedBytes > 0 ? (
          <>
            <h3 className="text-2xl font-bold text-foreground mb-1">{formatBytes(freedBytes)}</h3>
            <p className="text-muted-foreground">Espaço liberado nesta sessão</p>
          </>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-foreground mb-1">Análise Real do Aparelho</h3>
            <p className="text-muted-foreground">Dados do navegador via Storage API</p>
          </>
        )}
      </motion.div>

      {/* Info banner */}
      <motion.div
        className="glass-card p-4 flex items-start gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Valores obtidos em tempo real via <strong className="text-foreground">navigator.storage.estimate()</strong>,{" "}
          <strong className="text-foreground">Cache API</strong> e{" "}
          <strong className="text-foreground">Device Memory API</strong>. Limitados ao contexto do navegador (não ao SO).
        </p>
      </motion.div>

      {/* Metrics */}
      <div className="space-y-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.id}
            className="glass-card p-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="p-2 rounded-lg bg-primary/20 text-primary">{m.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{m.name}</p>
                <p className="text-sm text-muted-foreground">
                  {loading ? "Calculando..." : `${m.usedLabel} / ${m.totalLabel}`}
                </p>
                {m.note && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{m.note}</p>}
              </div>
              <span className="text-sm font-mono text-muted-foreground tabular-nums">
                {m.supported ? `${m.percentage.toFixed(1)}%` : "N/A"}
              </span>
            </div>

            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${getUsageColor(m.percentage)}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(m.percentage, 100)}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button
          onClick={optimize}
          disabled={optimizing || loading || !cache || cache.cacheCount === 0}
          size="xl"
          className="w-full"
        >
          {optimizing ? (
            <><RefreshCw className="w-5 h-5 animate-spin" />Limpando caches...</>
          ) : (
            <><Zap className="w-5 h-5" />Limpar Cache do Navegador</>
          )}
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />Atualizar
          </Button>
          <Button variant="outline" onClick={requestPersistent}>
            <HardDrive className="w-4 h-4" />Persistir
          </Button>
        </div>
      </div>
    </div>
  );
}
