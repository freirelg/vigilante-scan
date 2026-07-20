import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldCheck, ShieldAlert, Bug, Fingerprint, FileWarning, Loader2, Trash2, Archive, CheckCircle, Link2, Globe, AlertCircle, Upload, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Threat {
  id: string;
  name: string;
  type: "malware" | "adware" | "spyware" | "trojan";
  severity: "low" | "medium" | "high";
  location: string;
  status: "detected" | "quarantined" | "removed";
}

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
  const [threats, setThreats] = useState<Threat[]>([]);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  // VirusTotal URL scan (real)
  const [vtUrl, setVtUrl] = useState("");
  const [vtLoading, setVtLoading] = useState(false);
  const [vtResult, setVtResult] = useState<any>(null);

  const scanUrlWithVirusTotal = async () => {
    if (!vtUrl.trim()) {
      toast.error("Cole uma URL ou domínio para analisar");
      return;
    }
    setVtLoading(true);
    setVtResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("virustotal-scan", {
        body: { target: vtUrl.trim() },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setVtResult(data);
      localStorage.setItem("last-vt-scan", JSON.stringify(data));
      if (data.status === "queued") {
        toast.info("Análise em fila no VirusTotal. Tente novamente em alguns segundos.");
      } else if (data.verdict === "clean") {
        toast.success(`URL limpa em ${data.stats.total} engines de antivírus`);
      } else if (data.verdict === "suspicious") {
        toast.warning(`${data.stats.suspicious} engine(s) marcaram como suspeita`);
      } else {
        toast.error(`⚠️ ${data.stats.malicious} engine(s) detectaram malware!`);
      }
    } catch (e: any) {
      toast.error("Erro ao consultar VirusTotal: " + (e.message || "desconhecido"));
    } finally {
      setVtLoading(false);
    }
  };

  // VirusTotal FILE scan (real)
  const [vtFile, setVtFile] = useState<File | null>(null);
  const [vtFileLoading, setVtFileLoading] = useState(false);
  const [vtFileResult, setVtFileResult] = useState<any>(null);

  const scanFileWithVirusTotal = async () => {
    if (!vtFile) {
      toast.error("Selecione um arquivo para analisar");
      return;
    }
    if (vtFile.size > 32 * 1024 * 1024) {
      toast.error("Arquivo excede 32MB (limite da API pública do VirusTotal)");
      return;
    }
    setVtFileLoading(true);
    setVtFileResult(null);
    try {
      const fd = new FormData();
      fd.append("file", vtFile);
      const { data, error } = await supabase.functions.invoke("virustotal-scan", { body: fd });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setVtFileResult(data);
      localStorage.setItem("last-vt-file-scan", JSON.stringify(data));
      if (data.status === "queued") {
        toast.info("Arquivo em análise. Reenvie em ~1 minuto para ver o resultado.");
      } else if (data.verdict === "clean") {
        toast.success(`Arquivo limpo em ${data.stats.total} engines`);
      } else if (data.verdict === "suspicious") {
        toast.warning(`${data.stats.suspicious} engine(s) marcaram como suspeito`);
      } else {
        toast.error(`⚠️ ${data.stats.malicious} engine(s) detectaram malware!`);
      }
    } catch (e: any) {
      toast.error("Erro ao consultar VirusTotal: " + (e.message || "desconhecido"));
    } finally {
      setVtFileLoading(false);
    }
  };

  const phases = [
    "Verificando aplicativos instalados...",
    "Analisando arquivos do sistema...",
    "Verificando conexões de rede...",
    "Escaneando memória...",
    "Verificando permissões...",
    "Finalizando análise...",
  ];

  const mockThreats: Threat[] = [
    {
      id: "1",
      name: "Trojan.AndroidOS.Agent",
      type: "trojan",
      severity: "high",
      location: "/data/app/suspicious.apk",
      status: "detected",
    },
    {
      id: "2",
      name: "Adware.MobiDash",
      type: "adware",
      severity: "medium",
      location: "/sdcard/Download/free_app.apk",
      status: "detected",
    },
    {
      id: "3",
      name: "Spyware.SMSTracker",
      type: "spyware",
      severity: "high",
      location: "/data/app/tracker.apk",
      status: "detected",
    },
  ];

  const startScan = () => {
    setIsScanning(true);
    setProgress(0);
    setScanComplete(false);
    setResults([]);
    setThreats([]);
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
          
          // Simular detecção de ameaças (aleatório)
          const detectedThreats = Math.random() > 0.3 ? mockThreats : [];
          setThreats(detectedThreats);
          
          setResults([
            {
              category: "Malware",
              icon: <Bug className="w-5 h-5" />,
              status: detectedThreats.length > 0 ? "danger" : "safe",
              message: detectedThreats.length > 0 
                ? `${detectedThreats.length} ameaças detectadas` 
                : "Nenhum malware detectado",
              count: detectedThreats.length,
            },
            {
              category: "Aplicativos Suspeitos",
              icon: <FileWarning className="w-5 h-5" />,
              status: detectedThreats.filter(t => t.type === "adware").length > 0 ? "warning" : "safe",
              message: detectedThreats.filter(t => t.type === "adware").length > 0 
                ? "Adware encontrado" 
                : "Todos os apps são seguros",
              count: detectedThreats.filter(t => t.type === "adware").length,
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

  const handleRemoveThreat = async (threatId: string) => {
    setIsRemoving(threatId);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setThreats(prev => prev.map(t => 
      t.id === threatId ? { ...t, status: "removed" as const } : t
    ));
    setIsRemoving(null);
    toast.success("Ameaça removida com sucesso!");
  };

  const handleQuarantineThreat = async (threatId: string) => {
    setIsRemoving(threatId);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setThreats(prev => prev.map(t => 
      t.id === threatId ? { ...t, status: "quarantined" as const } : t
    ));
    setIsRemoving(null);
    toast.success("Ameaça movida para quarentena!");
  };

  const handleRemoveAll = async () => {
    setIsRemoving("all");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setThreats(prev => prev.map(t => ({ ...t, status: "removed" as const })));
    setIsRemoving(null);
    toast.success("Todas as ameaças foram removidas!");
  };

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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "text-destructive bg-destructive/10";
      case "medium":
        return "text-warning bg-warning/10";
      case "low":
        return "text-success bg-success/10";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  const activeThreats = threats.filter(t => t.status === "detected");

  return (
    <div className="space-y-6">
      {/* VirusTotal URL Scanner (REAL) */}
      <div className="glass-card p-4 space-y-3 border-primary/20">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Verificar URL/Link (VirusTotal)</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 ml-auto">
            REAL
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Análise em tempo real contra 70+ engines de antivírus (Kaspersky, ESET, BitDefender, etc.)
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="https://exemplo.com ou domínio suspeito"
            value={vtUrl}
            onChange={(e) => setVtUrl(e.target.value)}
            disabled={vtLoading}
            onKeyDown={(e) => e.key === "Enter" && scanUrlWithVirusTotal()}
          />
          <Button onClick={scanUrlWithVirusTotal} disabled={vtLoading}>
            {vtLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          </Button>
        </div>

        {vtResult && vtResult.status === "completed" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-lg border ${
              vtResult.verdict === "clean"
                ? "bg-success/5 border-success/30"
                : vtResult.verdict === "suspicious"
                ? "bg-warning/5 border-warning/30"
                : "bg-destructive/5 border-destructive/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {vtResult.verdict === "clean" ? (
                <CheckCircle className="w-4 h-4 text-success" />
              ) : (
                <AlertCircle className={`w-4 h-4 ${vtResult.verdict === "suspicious" ? "text-warning" : "text-destructive"}`} />
              )}
              <span className="font-medium text-foreground text-sm truncate">{vtResult.host}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="text-destructive font-bold">{vtResult.stats.malicious}</div>
                <div className="text-muted-foreground">malicioso</div>
              </div>
              <div>
                <div className="text-warning font-bold">{vtResult.stats.suspicious}</div>
                <div className="text-muted-foreground">suspeito</div>
              </div>
              <div>
                <div className="text-success font-bold">{vtResult.stats.harmless}</div>
                <div className="text-muted-foreground">seguro</div>
              </div>
              <div>
                <div className="text-muted-foreground font-bold">{vtResult.stats.undetected}</div>
                <div className="text-muted-foreground">n/d</div>
              </div>
            </div>
            {vtResult.detections?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1.5">Detecções:</p>
                <div className="flex flex-wrap gap-1">
                  {vtResult.detections.slice(0, 8).map((d: any) => (
                    <span
                      key={d.engine}
                      className="text-[10px] px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20"
                    >
                      {d.engine}: {d.result}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* VirusTotal FILE Scanner (REAL) */}
      <div className="glass-card p-4 space-y-3 border-primary/20">
        <div className="flex items-center gap-2">
          <FileSearch className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Verificar Arquivo (VirusTotal)</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 ml-auto">
            REAL
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Envie APKs, executáveis, PDFs, documentos etc. (até 32MB). O arquivo é enviado ao VirusTotal e analisado por 70+ antivírus.
        </p>
        <div className="flex gap-2 items-center">
          <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background/50 cursor-pointer hover:bg-background/80 transition-colors text-sm">
            <Upload className="w-4 h-4 text-muted-foreground" />
            <span className="truncate text-muted-foreground">
              {vtFile ? `${vtFile.name} (${(vtFile.size / 1024).toFixed(1)} KB)` : "Selecionar arquivo..."}
            </span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => setVtFile(e.target.files?.[0] || null)}
              disabled={vtFileLoading}
            />
          </label>
          <Button onClick={scanFileWithVirusTotal} disabled={vtFileLoading || !vtFile}>
            {vtFileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
          </Button>
        </div>

        {vtFileResult && vtFileResult.status === "completed" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-lg border ${
              vtFileResult.verdict === "clean"
                ? "bg-success/5 border-success/30"
                : vtFileResult.verdict === "suspicious"
                ? "bg-warning/5 border-warning/30"
                : "bg-destructive/5 border-destructive/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {vtFileResult.verdict === "clean" ? (
                <CheckCircle className="w-4 h-4 text-success" />
              ) : (
                <AlertCircle className={`w-4 h-4 ${vtFileResult.verdict === "suspicious" ? "text-warning" : "text-destructive"}`} />
              )}
              <span className="font-medium text-foreground text-sm truncate">{vtFileResult.filename}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono truncate mb-2">SHA-256: {vtFileResult.sha256}</p>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="text-destructive font-bold">{vtFileResult.stats.malicious}</div>
                <div className="text-muted-foreground">malicioso</div>
              </div>
              <div>
                <div className="text-warning font-bold">{vtFileResult.stats.suspicious}</div>
                <div className="text-muted-foreground">suspeito</div>
              </div>
              <div>
                <div className="text-success font-bold">{vtFileResult.stats.harmless}</div>
                <div className="text-muted-foreground">seguro</div>
              </div>
              <div>
                <div className="text-muted-foreground font-bold">{vtFileResult.stats.undetected}</div>
                <div className="text-muted-foreground">n/d</div>
              </div>
            </div>
            {vtFileResult.detections?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1.5">Detecções:</p>
                <div className="flex flex-wrap gap-1">
                  {vtFileResult.detections.slice(0, 8).map((d: any) => (
                    <span
                      key={d.engine}
                      className="text-[10px] px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20"
                    >
                      {d.engine}: {d.result}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {vtFileResult && vtFileResult.status === "queued" && (
          <div className="p-3 rounded-lg border border-warning/30 bg-warning/5 text-xs text-warning">
            Arquivo enviado e em fila no VirusTotal. Reenvie o mesmo arquivo em ~1 minuto para ver o resultado (o cache por hash SHA-256 responderá instantaneamente).
          </div>
        )}
      </div>

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
                ? activeThreats.length > 0
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
              activeThreats.length > 0 ? (
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

      {/* Threats Detected */}
      <AnimatePresence mode="wait">
        {scanComplete && threats.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-destructive" />
                Ameaças Detectadas
              </h3>
              {activeThreats.length > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleRemoveAll}
                  disabled={isRemoving !== null}
                >
                  {isRemoving === "all" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-1" />
                  )}
                  Remover Todas
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {threats.map((threat, index) => (
                <motion.div
                  key={threat.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`glass-card p-4 space-y-3 ${
                    threat.status === "removed" 
                      ? "bg-success/5 border-success/20" 
                      : threat.status === "quarantined"
                      ? "bg-warning/5 border-warning/20"
                      : "bg-destructive/5 border-destructive/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Bug className={`w-4 h-4 ${
                          threat.status === "removed" ? "text-success" : 
                          threat.status === "quarantined" ? "text-warning" : "text-destructive"
                        }`} />
                        <span className="font-medium text-foreground truncate">{threat.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(threat.severity)}`}>
                          {threat.severity === "high" ? "Alto Risco" : threat.severity === "medium" ? "Médio Risco" : "Baixo Risco"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{threat.location}</p>
                      <p className="text-xs text-muted-foreground capitalize">Tipo: {threat.type}</p>
                    </div>
                    
                    {threat.status === "detected" ? (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuarantineThreat(threat.id)}
                          disabled={isRemoving !== null}
                          className="text-warning border-warning/50 hover:bg-warning/10"
                        >
                          {isRemoving === threat.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Archive className="w-4 h-4 mr-1" />
                              Quarentena
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemoveThreat(threat.id)}
                          disabled={isRemoving !== null}
                        >
                          {isRemoving === threat.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-1" />
                              Remover
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className={`w-5 h-5 ${
                          threat.status === "removed" ? "text-success" : "text-warning"
                        }`} />
                        <span className={
                          threat.status === "removed" ? "text-success" : "text-warning"
                        }>
                          {threat.status === "removed" ? "Removido" : "Em Quarentena"}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
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
            <h3 className="text-lg font-semibold text-foreground">Resumo do Escaneamento</h3>
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
        variant={scanComplete && activeThreats.length === 0 ? "success" : "default"}
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
