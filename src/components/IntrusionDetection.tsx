import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, ShieldCheck, AlertTriangle, RefreshCw, Clipboard, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  runIntrusionScan,
  checkClipboardHijack,
  type IntrusionCheck,
  type Severity,
} from "@/lib/intrusionSignals";
import { toast } from "sonner";

const severityStyles: Record<Severity, { color: string; bg: string; icon: typeof ShieldCheck; label: string }> = {
  safe: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: ShieldCheck, label: "OK" },
  warn: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", icon: AlertTriangle, label: "Atenção" },
  danger: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: ShieldAlert, label: "Risco" },
};

export function IntrusionDetection() {
  const [checks, setChecks] = useState<IntrusionCheck[]>([]);
  const [scanning, setScanning] = useState(false);
  const [testingClipboard, setTestingClipboard] = useState(false);

  const runScan = async () => {
    setScanning(true);
    try {
      const results = await runIntrusionScan();
      setChecks(results);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    runScan();
  }, []);

  const testClipboard = async () => {
    setTestingClipboard(true);
    try {
      const result = await checkClipboardHijack();
      setChecks((prev) => prev.map((c) => (c.id === "clipper" ? result : c)));
      if (result.severity === "danger") toast.error("Clipper detectado!");
      else if (result.severity === "safe") toast.success("Clipboard íntegro.");
    } finally {
      setTestingClipboard(false);
    }
  };

  const dangerCount = checks.filter((c) => c.severity === "danger").length;
  const warnCount = checks.filter((c) => c.severity === "warn").length;
  const overallSeverity: Severity = dangerCount > 0 ? "danger" : warnCount > 0 ? "warn" : "safe";
  const overall = severityStyles[overallSeverity];
  const OverallIcon = overall.icon;

  return (
    <div className="space-y-4 pb-24">
      {/* Overall status */}
      <Card className={`p-6 border-2 ${overall.bg}`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${overall.bg}`}>
            <OverallIcon className={`w-8 h-8 ${overall.color}`} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">Detecção de Intrusão</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {overallSeverity === "danger"
                ? `${dangerCount} sinal(is) crítico(s) detectado(s).`
                : overallSeverity === "warn"
                ? `${warnCount} alerta(s) para revisar.`
                : "Nenhum sinal de comprometimento detectado."}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={runScan} disabled={scanning}>
            <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </Card>

      {/* Individual checks */}
      {checks.map((check, i) => {
        const style = severityStyles[check.severity];
        const Icon = style.icon;
        return (
          <motion.div
            key={check.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className={`p-5 border ${style.bg}`}>
              <div className="flex items-start gap-3">
                <Icon className={`w-6 h-6 mt-0.5 ${style.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{check.title}</h3>
                    <Badge variant="outline" className={`${style.color} border-current`}>
                      {style.label}
                    </Badge>
                  </div>
                  <p className="text-sm mt-2">{check.description}</p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{check.details}</p>

                  {check.evidence && check.evidence.length > 0 && (
                    <div className="mt-3 p-2 rounded bg-background/40 border border-border/50">
                      <p className="text-xs font-medium mb-1 text-muted-foreground">Evidências:</p>
                      <ul className="space-y-1">
                        {check.evidence.map((e, idx) => (
                          <li key={idx} className="text-xs font-mono text-muted-foreground break-all">
                            • {e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {check.id === "clipper" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={testClipboard}
                      disabled={testingClipboard}
                    >
                      <Clipboard className="w-4 h-4 mr-2" />
                      {testingClipboard ? "Testando..." : "Testar Clipboard"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}

      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="flex gap-3">
          <Activity className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Pacote A — Detecção de Intrusão.</strong> Checagens 100% reais no
            navegador: injeção de scripts/iframes por extensões, sequestro do clipboard (clipper) e divergência de IP
            público (proxy/MITM). Um PWA não vê processos do sistema — para varredura de arquivos use um antivírus
            nativo.
          </div>
        </div>
      </Card>
    </div>
  );
}
