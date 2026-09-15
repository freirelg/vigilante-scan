import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, ShieldCheck, AlertTriangle, RefreshCw, Clipboard, Activity, Fingerprint, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  runIntrusionScan,
  checkClipboardHijack,
  type IntrusionCheck,
  type Severity,
} from "@/lib/intrusionSignals";
import { runPackageBScan } from "@/lib/adwareSignals";
import {
  runPackageCScan,
  clearBaseline,
  resetBehaviorStats,
  startBehaviorMonitor,
} from "@/lib/behavioralSignals";
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
      const [pkgA, pkgB, pkgC] = await Promise.all([
        runIntrusionScan(),
        runPackageBScan(),
        runPackageCScan(),
      ]);
      setChecks([...pkgA, ...pkgB, ...pkgC]);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    startBehaviorMonitor();
    runScan();
  }, []);

  const resetFingerprint = () => {
    clearBaseline();
    toast.success("Aparelho registrado de novo. Fazendo uma nova análise.");
    runScan();
  };

  const resetBehavior = () => {
    resetBehaviorStats();
    toast.success("Contagem reiniciada.");
    runScan();
  };

  const testClipboard = async () => {
    setTestingClipboard(true);
    try {
      const result = await checkClipboardHijack();
      setChecks((prev) => prev.map((c) => (c.id === "clipper" ? result : c)));
      if (result.severity === "danger") toast.error("Algo trocou o que você copiou!");
      else if (result.severity === "safe") toast.success("O que você copia está seguro.");
    } finally {
      setTestingClipboard(false);
    }
  };

  const dangerCount = checks.filter((c) => c.severity === "danger").length;
  const warnCount = checks.filter((c) => c.severity === "warn").length;
  const overallSeverity: Severity = dangerCount > 0 ? "danger" : warnCount > 0 ? "warn" : "safe";
  const overall = severityStyles[overallSeverity];
  const OverallIcon = overall.icon;

  const calculateScore = () => {
    if (checks.length === 0) return 100;
    const penaltyPerDanger = 35;
    const penaltyPerWarn = 15;
    const score = 100 - (dangerCount * penaltyPerDanger + warnCount * penaltyPerWarn);
    return Math.max(0, score);
  };

  const intrusionScore = calculateScore();

  return (
    <div className="space-y-4 pb-24">
      {/* Overall status with Score */}
      <Card className={`p-6 border-2 ${overall.bg} relative overflow-hidden`}>
        {/* Animated background pulse for score */}
        <motion.div 
          className={`absolute inset-0 opacity-5 ${overall.bg}`}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="relative">
            <div className={`p-4 rounded-full border-4 ${overall.bg} flex items-center justify-center w-20 h-20`}>
              <span className={`text-2xl font-black ${overall.color}`}>{intrusionScore}</span>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 border border-border">
              <OverallIcon className={`w-5 h-5 ${overall.color}`} />
            </div>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">Sinais de invasão</h2>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-tighter">
                Nota real
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {overallSeverity === "danger"
                ? `${dangerCount} sinal(is) grave(s) encontrado(s).`
                : overallSeverity === "warn"
                ? `${warnCount} ponto(s) para você olhar com calma.`
                : "Nada suspeito encontrado no seu aparelho."}
            </p>
          </div>
          <Button size="icon" variant="outline" onClick={runScan} disabled={scanning} className="rounded-xl">
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
                      <p className="text-xs font-medium mb-1 text-muted-foreground">O que encontramos:</p>
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
                      {testingClipboard ? "Testando..." : "Testar cópia"}
                    </Button>
                  )}

                  {check.id === "fingerprint" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={resetFingerprint}
                    >
                      <Fingerprint className="w-4 h-4 mr-2" />
                      Registrar aparelho de novo
                    </Button>
                  )}

                  {check.id === "behavior" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={resetBehavior}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Começar a contagem de novo
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
          <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
            <p>
              <strong className="text-foreground">Parte A — Alguém mexendo no app.</strong> Vê se algum programa
              está colocando conteúdo estranho na tela, se algo troca o que você copia (golpe comum com chave Pix
              e carteiras) e se sua conexão está passando por alguém no meio do caminho.
            </p>
            <p>
              <strong className="text-foreground">Parte B — Propaganda escondida.</strong> Procura programas
              desconhecidos rodando em segundo plano e sites autorizados a te mandar avisos indesejados.
            </p>
            <p>
              <strong className="text-foreground">Parte C — Seu aparelho e seu jeito de usar.</strong> Guarda as
              características do seu celular (tela, som, memória) e avisa se mudarem de repente — pode ser sinal de
              que alguém está usando sua conta em outro lugar. Também percebe se os toques e a digitação parecem
              vir de um programa ou de uma tela falsa por cima.
            </p>
            <p className="opacity-70">
              Este app roda dentro do navegador e não consegue ver arquivos ou programas instalados no aparelho.
              Para uma varredura completa do sistema, use também um antivírus tradicional.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
