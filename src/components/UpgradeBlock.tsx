import { useState, useEffect } from "react";
import { Lock, Sparkles, Crown, Key, CreditCard, QrCode, CheckCircle2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  getScanLimit, 
  getScansUsed, 
  redeemCode, 
  getAccessLevel,
  unlockFullAccess
} from "@/lib/edition";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface UpgradeBlockProps {
  title?: string;
  reason?: "limit" | "premium";
  featureName?: string;
}

export function UpgradeBlock({
  title,
  reason = "limit",
  featureName,
}: UpgradeBlockProps) {
  const [code, setCode] = useState("");
  const [used, setUsed] = useState(getScansUsed());
  const [limit, setLimit] = useState(getScanLimit());
  const [level, setLevel] = useState(getAccessLevel());
  const [showPix, setShowPix] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  
  useEffect(() => {
    const handleUpdate = () => {
      setUsed(getScansUsed());
      setLimit(getScanLimit());
      setLevel(getAccessLevel());
    };
    window.addEventListener("freirenet-usage-updated", handleUpdate);
    return () => window.removeEventListener("freirenet-usage-updated", handleUpdate);
  }, []);

  const isLimit = reason === "limit";

  const handleRedeem = () => {
    const result = redeemCode(code);
    if (result.ok) {
      toast.success(result.message);
      setCode("");
    } else {
      toast.error(result.message);
    }
  };

  const handlePixPayment = () => {
    setIsPaying(true);
    // Simulate payment confirmation after 3 seconds
    setTimeout(() => {
      setIsPaying(false);
      setPaid(true);
      unlockFullAccess();
      toast.success("Pagamento confirmado! Versão PRO liberada.");
    }, 3000);
  };

  return (
    <Card className="p-6 bg-card border-border relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-accent/20 rounded-full blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg">
          {isLimit ? (
            <Lock className="w-8 h-8 text-primary-foreground" />
          ) : (
            <Crown className="w-8 h-8 text-primary-foreground" />
          )}
        </div>

        <Badge variant="outline" className="mb-3 border-primary/40 text-primary">
          FreireNet Start
        </Badge>

        <h3 className="text-lg font-bold text-foreground mb-2">
          {title ??
            (isLimit
              ? "Limite de scans atingido"
              : `${featureName ?? "Este recurso"} é da versão avançada`)}
        </h3>

        <div className="text-sm text-muted-foreground max-w-sm mb-4">
          {isLimit ? (
            <p>
              Você já usou <span className="text-foreground font-bold">{used}</span> de{" "}
              <span className="text-foreground font-bold">{limit === Infinity ? "∞" : limit}</span> scans disponíveis.
            </p>
          ) : (
            <p>Este recurso não está incluído na versão gratuita Start.</p>
          )}
        </div>

        {/* PIX Payment Section */}
        <AnimatePresence mode="wait">
          {!showPix && !paid ? (
            <motion.div 
              key="cta"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-sm space-y-4 mb-6"
            >
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Versão PRO Vitalícia</span>
                  <Badge variant="secondary" className="bg-primary text-primary-foreground font-bold">
                    R$ 1,99
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground text-left">
                  Desbloqueie todos os recursos, scans ilimitados e proteção avançada com um pagamento único via PIX.
                </p>
                <Button 
                  onClick={() => setShowPix(true)}
                  className="w-full gap-2 bg-[#32BCAD] hover:bg-[#2aa89b] text-white border-none"
                >
                  <CreditCard className="w-4 h-4" />
                  Pagar com PIX
                </Button>
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Ou use uma senha</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Digite a senha para desbloquear"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="pl-10 bg-secondary/50 border-border"
                  />
                </div>
                <Button 
                  onClick={handleRedeem}
                  className="w-full gap-2"
                  variant="outline"
                >
                  Validar Senha
                </Button>
              </div>
            </motion.div>
          ) : showPix && !paid ? (
            <motion.div 
              key="pix"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm space-y-4 mb-6 p-4 rounded-xl border border-border bg-muted/30"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-[#32BCAD]" />
                  Pagamento PIX
                </h4>
                <Button variant="ghost" size="sm" onClick={() => setShowPix(false)} className="h-7 text-xs">
                  Voltar
                </Button>
              </div>

              <div className="aspect-square w-48 mx-auto bg-white p-2 rounded-lg relative group">
                {/* QR Code Placeholder with PIX styling */}
                <div className="w-full h-full border-2 border-dashed border-muted flex items-center justify-center bg-slate-50">
                  <QrCode className="w-24 h-24 text-slate-300" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/90 transition-opacity">
                    <p className="text-[10px] text-slate-600 font-medium px-4">QR Code Gerado para FreireNet PRO</p>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  Escaneie o QR Code ou copie a chave PIX abaixo
                </p>
                <div className="bg-secondary/50 p-2 rounded border border-border text-[10px] font-mono break-all text-left">
                  00020126360014br.gov.bcb.pix0114freirenetpro199...
                </div>
                <Button 
                  onClick={handlePixPayment}
                  disabled={isPaying}
                  className="w-full gap-2 bg-[#32BCAD] hover:bg-[#2aa89b] text-white"
                >
                  {isPaying ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </motion.div>
                      Confirmando...
                    </>
                  ) : (
                    "Confirmar Pagamento"
                  )}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm py-8 space-y-4 text-center"
            >
              <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-12 h-12 text-success" />
              </div>
              <h4 className="text-xl font-bold text-success">Acesso Liberado!</h4>
              <p className="text-sm text-muted-foreground px-6">
                Obrigado por apoiar o FreireNet SecureGuard. Todos os recursos PRO já estão disponíveis para você.
              </p>
              <Button onClick={() => window.location.reload()} className="w-full">
                Recarregar App
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[10px] text-muted-foreground italic mb-6">
          {level === 0 && "Insira a senha de 50 scans ou de Acesso Livre."}
          {level === 1 && "Insira a senha de Acesso Livre para libertação total."}
          {level >= 2 && "Acesso total liberado!"}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm mb-5 text-left">
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Essencial
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Scans ilimitados, otimização e histórico completo.
            </p>
          </div>
          <div className="p-3 rounded-lg border border-primary/40 bg-primary/5">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Pro</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Detecção de intrusão, rede avançada e auditoria de senhas.
            </p>
          </div>
        </div>

        {!paid && (
          <Button className="gap-2 w-full max-w-sm" size="lg" disabled>
            <Crown className="w-4 h-4" />
            Versão Lançamento
          </Button>
        )}
      </div>
    </Card>
  );
}
