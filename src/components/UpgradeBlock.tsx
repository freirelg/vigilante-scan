import { useState, useEffect } from "react";
import { Lock, Sparkles, Crown, Key } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  getScanLimit, 
  getScansUsed, 
  redeemCode, 
  getAccessLevel 
} from "@/lib/edition";
import { toast } from "sonner";

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

        {/* Password entry for unlocking */}
        <div className="w-full max-w-sm space-y-3 mb-6">
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
            variant="secondary"
          >
            Validar Senha
          </Button>
          
          <p className="text-[10px] text-muted-foreground italic">
            {level === 0 && "Insira a senha de 50 scans ou de Acesso Livre."}
            {level === 1 && "Insira a senha de Acesso Livre para libertação total."}
            {level >= 2 && "Acesso total liberado!"}
          </p>
        </div>

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

        <Button className="gap-2 w-full max-w-sm" size="lg" disabled>
          <Crown className="w-4 h-4" />
          Atualizar em breve
        </Button>
      </div>
    </Card>
  );
}
