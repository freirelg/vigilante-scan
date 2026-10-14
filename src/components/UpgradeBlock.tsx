import { useState, useEffect } from "react";
import { Lock, Sparkles, Crown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getScanLimit, getScansUsed } from "@/lib/edition";

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
  const [used, setUsed] = useState(getScansUsed());
  const [limit, setLimit] = useState(getScanLimit());

  useEffect(() => {
    const handleUpdate = () => {
      setUsed(getScansUsed());
      setLimit(getScanLimit());
    };
    window.addEventListener("freirenet-usage-updated", handleUpdate);
    return () => window.removeEventListener("freirenet-usage-updated", handleUpdate);
  }, []);

  const isLimit = reason === "limit";

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

        <div className="w-full max-w-sm rounded-lg border border-border bg-secondary/30 p-4 mb-6 text-left">
          <p className="text-sm font-semibold text-foreground mb-1">
            Validação de licenças temporariamente indisponível
          </p>
          <p className="text-xs text-muted-foreground">
            Por segurança, códigos de desbloqueio não são aceitos no navegador.
            O acesso pago será habilitado quando a validação segura no servidor estiver configurada.
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
