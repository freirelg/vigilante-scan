import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldCheck, ShieldAlert, Bug, Fingerprint, FileWarning, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ScanResult {
  category: string;
  icon: React.ReactNode;
  status: "safe" | "warning" | "danger";
  message: string;
  count: number;
}

export function SecurityScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState("");
  const [scanComplete, setScanComplete] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);

  const phases = [
    "Verificando aplicativos instalados...",
    "Analisando arquivos do sistema...",
    "Verificando conexões de rede...",
    "Escaneando memória...",
    "Verificando permissões...",
    "Finalizando análise...",
  ];

  const startScan = () => {
    setIsScanning(true);
    setProgress(0);
    setScanComplete(false);
    setResults([]);
  };

  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + Math.random() * 3 + 1;
        
        const phaseIndex = Math.floor((newProgress / 100) * phases.length);
        if (phaseIndex < phases.length) {
          setCurrentPhase(phases[phaseIndex]);
        }

        if (newProgress >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          setScanComplete(true);
          setResults([
            {
              category: "Malware",
              icon: <Bug className="w-5 h-5" />,
              status: "safe",
              message: "Nenhum malware detectado",
              count: 0,
            },
            {
              category: "Aplicativos Suspeitos",
              icon: <FileWarning className="w-5 h-5" />,
              status: "safe",
              message: "Todos os apps são seguros",
              count: 0,
            },
            {
              category: "Permissões",
              icon: <Fingerprint className="w-5 h-5" />,
              status: "warning",
              message: "3 apps com permissões excessivas",
              count: 3,
            },
            {
              category: "Rede",
              icon: <Shield className="w-5 h-5" />,
              status: "safe",
              message: "Conexão segura",
              count: 0,
            },
          ]);
          return 100;
        }
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isScanning]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "safe":
        return "text-success";
      case "warning":
        return "text-warning";
      case "danger":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "safe":
        return "bg-success/10";
      case "warning":
        return "bg-warning/10";
      case "danger":
        return "bg-destructive/10";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="space-y-6">
      {/* Scanner Visual */}
      <div className="relative flex items-center justify-center py-8">
        <motion.div
          className="relative w-48 h-48 flex items-center justify-center"
          animate={isScanning ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          
          {/* Animated rings */}
          {isScanning && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary"
                initial={{ scale: 0.8, opacity: 1 }}
                animate={{ scale: 1.4, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary"
                initial={{ scale: 0.8, opacity: 1 }}
                animate={{ scale: 1.4, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
              />
            </>
          )}

          {/* Center icon */}
          <motion.div
            className={`w-24 h-24 rounded-full flex items-center justify-center ${
              scanComplete
                ? results.some((r) => r.status === "danger")
                  ? "gradient-danger"
                  : results.some((r) => r.status === "warning")
                  ? "gradient-warning"
                  : "gradient-success glow-success"
                : isScanning
                ? "gradient-primary glow-primary"
                : "bg-secondary"
            }`}
            animate={isScanning ? { rotate: 360 } : {}}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            {isScanning ? (
              <Loader2 className="w-12 h-12 text-primary-foreground animate-spin" />
            ) : scanComplete ? (
              results.some((r) => r.status === "danger") ? (
                <ShieldAlert className="w-12 h-12 text-destructive-foreground" />
              ) : (
                <ShieldCheck className="w-12 h-12 text-success-foreground" />
              )
            ) : (
              <Shield className="w-12 h-12 text-foreground" />
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Progress */}
      <AnimatePresence mode="wait">
        {isScanning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-3"
          >
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{currentPhase}</span>
              <span className="text-primary font-mono">{Math.round(progress)}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence mode="wait">
        {scanComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {results.map((result, index) => (
              <motion.div
                key={result.category}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`glass-card p-4 flex items-center gap-4 ${getStatusBg(result.status)}`}
              >
                <div className={`p-2 rounded-lg ${getStatusBg(result.status)} ${getStatusColor(result.status)}`}>
                  {result.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{result.category}</p>
                  <p className={`text-sm ${getStatusColor(result.status)}`}>{result.message}</p>
                </div>
                {result.count > 0 && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBg(result.status)} ${getStatusColor(result.status)}`}>
                    {result.count}
                  </span>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Button */}
      <Button
        onClick={startScan}
        disabled={isScanning}
        size="xl"
        className="w-full"
        variant={scanComplete ? "success" : "default"}
      >
        {isScanning ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Escaneando...
          </>
        ) : scanComplete ? (
          <>
            <ShieldCheck className="w-5 h-5" />
            Escanear Novamente
          </>
        ) : (
          <>
            <Shield className="w-5 h-5" />
            Iniciar Escaneamento
          </>
        )}
      </Button>
    </div>
  );
}
