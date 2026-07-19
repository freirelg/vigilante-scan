import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi,
  Globe,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Radio,
  ShieldAlert,
  Eye,
  Server,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type CheckStatus = "idle" | "running" | "safe" | "warning" | "danger";

interface NetworkCheck {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: CheckStatus;
  details?: string;
  data?: string[];
  recommendation?: string;
}

// Detecta IPs locais e públicos via WebRTC (real)
async function detectWebRTCLeaks(): Promise<{
  localIPs: string[];
  publicIPs: string[];
  supported: boolean;
}> {
  return new Promise((resolve) => {
    const localIPs = new Set<string>();
    const publicIPs = new Set<string>();

    const RTCPeerConnection =
      window.RTCPeerConnection ||
      (window as any).webkitRTCPeerConnection ||
      (window as any).mozRTCPeerConnection;

    if (!RTCPeerConnection) {
      resolve({ localIPs: [], publicIPs: [], supported: false });
      return;
    }

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pc.createDataChannel("");

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        const candidate = event.candidate.candidate;
        // Regex para IPv4 e IPv6
        const ipRegex =
          /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/gi;
        const matches = candidate.match(ipRegex);
        if (!matches) return;

        matches.forEach((ip) => {
          // Ignora mDNS hashes
          if (ip.endsWith(".local")) return;

          const isPrivate =
            /^(10\.|127\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.|::1|fc|fd|fe80)/i.test(
              ip
            );

          if (isPrivate) {
            localIPs.add(ip);
          } else {
            publicIPs.add(ip);
          }
        });
      };

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {});

      setTimeout(() => {
        try {
          pc.close();
        } catch {}
        resolve({
          localIPs: Array.from(localIPs),
          publicIPs: Array.from(publicIPs),
          supported: true,
        });
      }, 2500);
    } catch {
      resolve({ localIPs: [], publicIPs: [], supported: false });
    }
  });
}

export function NetworkSecurity() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [checks, setChecks] = useState<NetworkCheck[]>([]);

  const runFullScan = async () => {
    setIsScanning(true);
    setScanned(false);

    const initialChecks: NetworkCheck[] = [
      {
        id: "https",
        title: "Conexão HTTPS",
        description: "Verificando criptografia da conexão",
        icon: <Lock className="w-5 h-5" />,
        status: "running",
      },
      {
        id: "webrtc",
        title: "Vazamento WebRTC",
        description: "Detectando exposição via RTCPeerConnection",
        icon: <Radio className="w-5 h-5" />,
        status: "running",
      },
      {
        id: "localip",
        title: "Exposição de IP Local",
        description: "Analisando IPs privados expostos",
        icon: <Eye className="w-5 h-5" />,
        status: "running",
      },
      {
        id: "publicip",
        title: "IP Público",
        description: "Verificando IP público visível",
        icon: <Globe className="w-5 h-5" />,
        status: "running",
      },
      {
        id: "dns",
        title: "Protocolo Seguro (TLS)",
        description: "Analisando integridade do transporte",
        icon: <Server className="w-5 h-5" />,
        status: "running",
      },
    ];

    setChecks(initialChecks);

    // 1. HTTPS check (real)
    await new Promise((r) => setTimeout(r, 600));
    const isHttps = window.location.protocol === "https:";
    const isLocalhost = ["localhost", "127.0.0.1"].includes(
      window.location.hostname
    );

    setChecks((prev) =>
      prev.map((c) =>
        c.id === "https"
          ? {
              ...c,
              status: isHttps || isLocalhost ? "safe" : "danger",
              icon: isHttps ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />,
              details: isHttps
                ? `Conexão criptografada via ${window.location.protocol.toUpperCase()}`
                : isLocalhost
                  ? "Ambiente local (desenvolvimento)"
                  : "Conexão HTTP não criptografada detectada!",
              recommendation: !isHttps && !isLocalhost
                ? "Acesse este site apenas por HTTPS. Dados enviados por HTTP podem ser interceptados."
                : undefined,
            }
          : c
      )
    );

    // 2. WebRTC + IPs (real)
    await new Promise((r) => setTimeout(r, 400));
    const leak = await detectWebRTCLeaks();

    setChecks((prev) =>
      prev.map((c) => {
        if (c.id === "webrtc") {
          if (!leak.supported) {
            return {
              ...c,
              status: "safe",
              details: "WebRTC não disponível neste navegador",
            };
          }
          const totalLeaks = leak.localIPs.length + leak.publicIPs.length;
          return {
            ...c,
            status: totalLeaks === 0 ? "safe" : leak.publicIPs.length > 0 ? "warning" : "warning",
            details:
              totalLeaks === 0
                ? "Nenhum vazamento WebRTC detectado"
                : `${totalLeaks} endereço(s) exposto(s) via WebRTC`,
            data: [...leak.localIPs, ...leak.publicIPs],
            recommendation:
              totalLeaks > 0
                ? "Use uma VPN com proteção WebRTC ou desabilite WebRTC no navegador para evitar rastreamento."
                : undefined,
          };
        }
        if (c.id === "localip") {
          return {
            ...c,
            status: leak.localIPs.length === 0 ? "safe" : "warning",
            details:
              leak.localIPs.length === 0
                ? "Nenhum IP local exposto"
                : `${leak.localIPs.length} IP(s) da rede interna visível(is)`,
            data: leak.localIPs,
            recommendation:
              leak.localIPs.length > 0
                ? "Sites podem descobrir a estrutura da sua rede local. Considere bloquear WebRTC em contextos sensíveis."
                : undefined,
          };
        }
        if (c.id === "publicip") {
          return {
            ...c,
            status: leak.publicIPs.length === 0 ? "safe" : "danger",
            details:
              leak.publicIPs.length === 0
                ? "IP público protegido"
                : `IP público exposto${!isHttps ? " sem criptografia" : ""}`,
            data: leak.publicIPs,
            recommendation:
              leak.publicIPs.length > 0
                ? "Seu IP público real está visível mesmo se usar proxy. Uma VPN com bloqueio WebRTC é recomendada."
                : undefined,
          };
        }
        return c;
      })
    );

    // 3. TLS/Transport
    await new Promise((r) => setTimeout(r, 500));
    setChecks((prev) =>
      prev.map((c) =>
        c.id === "dns"
          ? {
              ...c,
              status: isHttps || isLocalhost ? "safe" : "warning",
              details: isHttps
                ? "Transporte protegido por TLS"
                : "Transporte inseguro — dados em texto claro",
              recommendation: !isHttps && !isLocalhost
                ? "Habilite HSTS e HTTPS obrigatório no servidor."
                : undefined,
            }
          : c
      )
    );

    setIsScanning(false);
    setScanned(true);

    const finalIssues = (localCount: number, publicCount: number) => {
      if (publicCount > 0 || !isHttps) return "danger";
      if (localCount > 0) return "warning";
      return "safe";
    };
    const overall = finalIssues(leak.localIPs.length, leak.publicIPs.length);
    if (overall === "danger") toast.error("Vulnerabilidades críticas detectadas!");
    else if (overall === "warning") toast.warning("Algumas exposições foram detectadas");
    else toast.success("Sua rede está segura!");
  };

  const getBg = (status: CheckStatus) => {
    if (status === "safe") return "bg-success/5 border-success/20";
    if (status === "warning") return "bg-warning/5 border-warning/20";
    if (status === "danger") return "bg-destructive/5 border-destructive/20";
    return "bg-card border-border";
  };

  const getIconWrap = (status: CheckStatus) => {
    if (status === "safe") return "bg-success/20 text-success";
    if (status === "warning") return "bg-warning/20 text-warning";
    if (status === "danger") return "bg-destructive/20 text-destructive";
    return "bg-primary/20 text-primary";
  };

  const StatusIcon = ({ status }: { status: CheckStatus }) => {
    if (status === "running") return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
    if (status === "safe") return <CheckCircle className="w-5 h-5 text-success" />;
    if (status === "warning") return <AlertTriangle className="w-5 h-5 text-warning" />;
    if (status === "danger") return <ShieldAlert className="w-5 h-5 text-destructive" />;
    return null;
  };

  const criticalCount = checks.filter((c) => c.status === "danger").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;
  const safeCount = checks.filter((c) => c.status === "safe").length;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <motion.div
        className="glass-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl gradient-primary glow-primary">
            <Wifi className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Análise de Rede</h3>
            <p className="text-sm text-muted-foreground">
              WebRTC, HTTPS e exposição de IP
            </p>
          </div>
        </div>

        {scanned && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-3 rounded-lg bg-success/10">
              <p className="text-2xl font-bold text-success">{safeCount}</p>
              <p className="text-xs text-muted-foreground">Seguros</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-warning/10">
              <p className="text-2xl font-bold text-warning">{warningCount}</p>
              <p className="text-xs text-muted-foreground">Alertas</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-destructive/10">
              <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Críticos</p>
            </div>
          </div>
        )}

        <Button
          onClick={runFullScan}
          disabled={isScanning}
          size="lg"
          className="w-full"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analisando rede...
            </>
          ) : scanned ? (
            <>
              <RefreshCw className="w-5 h-5" />
              Analisar Novamente
            </>
          ) : (
            <>
              <Wifi className="w-5 h-5" />
              Iniciar Análise de Rede
            </>
          )}
        </Button>
      </motion.div>

      {/* Checks List */}
      <AnimatePresence>
        {checks.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {checks.map((check, index) => (
              <motion.div
                key={check.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`glass-card p-4 border ${getBg(check.status)}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${getIconWrap(check.status)}`}>
                    {check.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-medium text-foreground">{check.title}</p>
                      <StatusIcon status={check.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {check.details || check.description}
                    </p>

                    {check.data && check.data.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {check.data.map((item) => (
                          <div
                            key={item}
                            className="font-mono text-xs px-2 py-1 rounded bg-muted/50 text-foreground inline-block mr-1"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    )}

                    {check.recommendation && (
                      <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                        <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-warning" />
                          Recomendação
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {check.recommendation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info */}
      <motion.div
        className="glass-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h4 className="font-semibold text-foreground mb-3">O que é analisado?</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Radio className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>
              <strong className="text-foreground">WebRTC:</strong> tecnologia que
              pode revelar seu IP real mesmo usando VPN
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>
              <strong className="text-foreground">HTTPS:</strong> criptografia
              que protege dados em trânsito
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Eye className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>
              <strong className="text-foreground">IP Local:</strong> endereços
              internos da sua rede que podem ser expostos
            </span>
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
