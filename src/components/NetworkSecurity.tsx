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
  ShieldCheck,
  FileWarning,
  MapPin,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveTrafficChart } from "@/components/LiveTrafficChart";
import {
  checkDoH,
  scanMixedContent,
  analyzeTls,
  measureLatency,
  geolocateIP,
  checkHstsPreload,
} from "@/lib/networkExtras";
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
      {
        id: "doh",
        title: "DNS-over-HTTPS (DoH)",
        description: "Testando resolvedores DNS criptografados",
        icon: <ShieldCheck className="w-5 h-5" />,
        status: "running",
      },
      {
        id: "mixed",
        title: "Conteúdo Misto (Mixed Content)",
        description: "Procurando recursos HTTP em página HTTPS",
        icon: <FileWarning className="w-5 h-5" />,
        status: "running",
      },
      {
        id: "tls",
        title: "Protocolo HTTP (TLS)",
        description: "Detectando HTTP/2, HTTP/3 (QUIC) ou legado",
        icon: <Server className="w-5 h-5" />,
        status: "running",
      },
      {
        id: "latency",
        title: "Latência & Jitter",
        description: "Medindo ping para múltiplos endpoints",
        icon: <Radio className="w-5 h-5" />,
        status: "running",
      },
      {
        id: "geoip",
        title: "Geolocalização do IP",
        description: "Comparando IP público com fuso horário do navegador",
        icon: <MapPin className="w-5 h-5" />,
        status: "running",
      },
      {
        id: "hsts",
        title: "HSTS Preload",
        description: "Consultando lista pública de domínios HTTPS obrigatório",
        icon: <ListChecks className="w-5 h-5" />,
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

    // 4. DNS-over-HTTPS (real)
    const doh = await checkDoH();
    const okProviders = doh.providers.filter((p) => p.ok);
    setChecks((prev) =>
      prev.map((c) =>
        c.id === "doh"
          ? {
              ...c,
              status: okProviders.length >= 2 ? "safe" : okProviders.length === 1 ? "warning" : "danger",
              details:
                okProviders.length === 0
                  ? "Nenhum resolvedor DoH acessível — DNS pode estar em texto claro"
                  : `${okProviders.length}/${doh.providers.length} resolvedores DoH respondendo`,
              data: doh.providers.map(
                (p) => `${p.name}: ${p.ok ? `OK (${p.ms}ms)` : "falhou"}`
              ),
              recommendation:
                okProviders.length < 2
                  ? "Ative DNS-over-HTTPS no navegador (Chrome/Firefox → Privacidade → DNS seguro) ou no sistema para impedir que provedores vejam seus domínios."
                  : undefined,
            }
          : c
      )
    );

    // 5. Mixed Content (real)
    const mixed = await scanMixedContent();
    setChecks((prev) =>
      prev.map((c) =>
        c.id === "mixed"
          ? {
              ...c,
              status: !mixed.pageIsHttps
                ? "warning"
                : mixed.insecureResources.length === 0
                  ? "safe"
                  : "danger",
              details: !mixed.pageIsHttps
                ? "Página não é HTTPS — teste não aplicável"
                : mixed.insecureResources.length === 0
                  ? `Nenhum recurso HTTP detectado em ${mixed.totalResources} carregados${mixed.upgradesInsecure ? " • CSP com upgrade-insecure-requests ativo" : ""}`
                  : `${mixed.insecureResources.length} recurso(s) HTTP em página HTTPS`,
              data: mixed.insecureResources.slice(0, 6).map((r) => `${r.type}: ${r.url}`),
              recommendation:
                mixed.insecureResources.length > 0
                  ? "Substitua as URLs http:// por https:// e adicione o header CSP 'upgrade-insecure-requests' para forçar o navegador a promover pedidos inseguros."
                  : !mixed.hasCSP && mixed.pageIsHttps
                    ? "Adicione um Content-Security-Policy no servidor para reforçar a proteção contra scripts externos."
                    : undefined,
            }
          : c
      )
    );

    // 6. TLS / Protocol (real via nextHopProtocol)
    const tls = analyzeTls();
    setChecks((prev) =>
      prev.map((c) =>
        c.id === "tls"
          ? {
              ...c,
              status: tls.sampleSize === 0
                ? "warning"
                : tls.modern
                  ? "safe"
                  : "warning",
              details: tls.sampleSize === 0
                ? "Nenhum recurso analisado ainda"
                : `Protocolo dominante: ${tls.label} (${tls.sampleSize} recursos)`,
              data: Object.entries(tls.distribution).map(
                ([k, v]) => `${k}: ${v}`
              ),
              recommendation: !tls.modern && tls.sampleSize > 0
                ? "Ative HTTP/2 ou HTTP/3 (QUIC) no servidor/CDN — protocolos modernos oferecem multiplexing, header compression e menor latência frente ao HTTP/1.1."
                : undefined,
            }
          : c
      )
    );

    // 7. Latência & Jitter (real)
    const lat = await measureLatency(3);
    const okEndpoints = lat.endpoints.filter((e) => e.ok);
    setChecks((prev) =>
      prev.map((c) =>
        c.id === "latency"
          ? {
              ...c,
              status: okEndpoints.length === 0
                ? "danger"
                : lat.anomaly || (lat.avgAll ?? 0) > 400
                  ? "warning"
                  : "safe",
              details: okEndpoints.length === 0
                ? "Nenhum endpoint respondeu — conexão instável ou bloqueada"
                : `Média ${Math.round(lat.avgAll ?? 0)}ms • Jitter ${Math.round(lat.jitterAll ?? 0)}ms`,
              data: lat.endpoints.map((e) =>
                e.ok
                  ? `${e.name}: ${Math.round(e.avg ?? 0)}ms (jitter ${Math.round(e.jitter ?? 0)}ms)`
                  : `${e.name}: falhou`
              ),
              recommendation: lat.anomaly
                ? "Diferença grande de latência entre endpoints — possível proxy, VPN mal configurada ou roteamento anômalo interceptando parte do tráfego."
                : (lat.avgAll ?? 0) > 400
                  ? "Latência alta (>400ms). Verifique a qualidade do Wi-Fi/celular ou se há VPN adicionando saltos."
                  : (lat.jitterAll ?? 0) > 80
                    ? "Jitter elevado indica conexão instável — ruim para chamadas e streaming."
                    : undefined,
            }
          : c
      )
    );

    // 8. Geolocalização do IP (real)
    const geo = await geolocateIP();
    setChecks((prev) =>
      prev.map((c) =>
        c.id === "geoip"
          ? {
              ...c,
              status: geo.sources.every((s) => !s.ok)
                ? "warning"
                : geo.vpnSuspected
                  ? "warning"
                  : "safe",
              details: geo.sources.every((s) => !s.ok)
                ? "Não foi possível consultar provedores de geolocalização"
                : geo.vpnSuspected
                  ? `Divergência detectada • IP ${geo.ip ?? "?"} (${geo.country ?? "?"})`
                  : `IP ${geo.ip ?? "?"} • ${geo.city ?? ""}${geo.city ? ", " : ""}${geo.country ?? "?"}`,
              data: [
                ...(geo.ip ? [`IP: ${geo.ip}`] : []),
                ...(geo.org ? [`ASN/Org: ${geo.org}`] : []),
                ...(geo.ipTimezone ? [`Fuso do IP: ${geo.ipTimezone}`] : []),
                `Fuso do navegador: ${geo.browserTimezone}`,
                ...geo.sources.map((s) =>
                  `${s.name}: ${s.ok ? s.ip ?? "ok" : "falhou"}`
                ),
              ],
              recommendation: !geo.ipsMatch
                ? "Provedores retornaram IPs diferentes — possível proxy transparente, CDN intermediária ou VPN mal configurada."
                : geo.ipTimezone && !geo.timezoneMatch
                  ? `Fuso do IP (${geo.ipTimezone}) difere do fuso do navegador (${geo.browserTimezone}). Isso é normal com VPN, mas pode indicar proxy malicioso se você não ativou uma.`
                  : undefined,
            }
          : c
      )
    );

    // 9. HSTS Preload (real)
    const hsts = await checkHstsPreload();
    setChecks((prev) =>
      prev.map((c) =>
        c.id === "hsts"
          ? {
              ...c,
              status: !hsts.supported
                ? "warning"
                : hsts.preloaded
                  ? "safe"
                  : "warning",
              details: hsts.status === "local"
                ? "Ambiente local — verificação não aplicável"
                : hsts.status === "error"
                  ? `Falha ao consultar hstspreload.org (${hsts.error ?? "erro"})`
                  : hsts.preloaded
                    ? `${hsts.domain} está na lista HSTS Preload dos navegadores`
                    : `${hsts.domain} não está pré-carregado (status: ${hsts.status})`,
              data: [`Domínio: ${hsts.domain}`, `Status: ${hsts.status}`],
              recommendation: hsts.supported && !hsts.preloaded
                ? "Envie o domínio para hstspreload.org e configure o header Strict-Transport-Security com max-age=63072000; includeSubDomains; preload para bloquear downgrade HTTPS→HTTP na primeira visita."
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

        <div className="mb-4">
          <LiveTrafficChart />
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
