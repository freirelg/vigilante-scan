import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, Lock, Shield, AlertTriangle, CheckCircle,
  Copy, RefreshCw, Search, Lightbulb, ChevronRight, ShieldAlert, Loader2, Trash2, Plus, Info, Clock, Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { checkPasswordPwned } from "@/lib/hibp";
import { PasswordRiskSummary } from "@/components/PasswordRiskSummary";
import { PasswordCsvImport } from "@/components/PasswordCsvImport";
import {
  analyzeReal, classifyCriticality, CRITICALITY_LABEL, CRITICALITY_COLOR,
  type Criticality, type DangerPattern,
} from "@/lib/passwordSignals";

interface AuditedPassword {
  id: string;
  service: string;
  password: string;
  strength: number;
  score: 0 | 1 | 2 | 3 | 4;
  crackTime: string;
  patterns: DangerPattern[];
  criticality: Criticality;
  criticalityReason: string;
  suggestions: string[];
  warning: string;
  pwned: boolean;
  pwnedCount: number;
  checking: boolean;
}

function buildAudit(service: string, password: string) {
  const a = analyzeReal(password, { service });
  const c = classifyCriticality(service);
  return {
    strength: a.strength,
    score: a.score,
    crackTime: a.crackTime,
    patterns: a.patterns,
    suggestions: a.suggestions,
    warning: a.warning,
    criticality: c.level,
    criticalityReason: c.reason,
  };
}


const generateStrongPassword = (length = 16) => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
};

export function PasswordAnalyzer() {
  const [audited, setAudited] = useState<AuditedPassword[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const [newService, setNewService] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [adding, setAdding] = useState(false);

  const [customPassword, setCustomPassword] = useState("");
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [customPwned, setCustomPwned] = useState<{ pwned: boolean; count: number } | null>(null);
  const [customChecking, setCustomChecking] = useState(false);

  // Persist audit summary for VulnerabilityScore
  useEffect(() => {
    if (audited.length === 0) return;
    const weak = audited.filter((p) => p.strength < 60 || p.pwned).length;
    localStorage.setItem(
      "last-password-audit",
      JSON.stringify({ weak, total: audited.length, at: Date.now() }),
    );
  }, [audited]);

  const addPassword = async () => {
    if (!newService.trim() || !newPassword) {
      toast.error("Preencha o serviço e a senha");
      return;
    }
    setAdding(true);
    const service = newService.trim();
    const audit = buildAudit(service, newPassword);
    const id = crypto.randomUUID();
    const entry: AuditedPassword = {
      id,
      service,
      password: newPassword,
      ...audit,
      pwned: false,
      pwnedCount: 0,
      checking: true,
    };
    setAudited((prev) => [entry, ...prev]);
    setNewService("");
    setNewPassword("");

    try {
      const result = await checkPasswordPwned(newPassword);
      setAudited((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, pwned: result.pwned, pwnedCount: result.count, checking: false } : p
        )
      );
      if (result.pwned) {
        toast.error(`Senha exposta em ${result.count.toLocaleString("pt-BR")} vazamentos!`);
      } else if (audit.strength >= 80) {
        toast.success("Senha forte e não encontrada em vazamentos");
      }
    } catch {
      setAudited((prev) => prev.map((p) => (p.id === id ? { ...p, checking: false } : p)));
      toast.error("Não foi possível consultar a base de vazamentos");
    } finally {
      setAdding(false);
    }
  };

  const removePassword = (id: string) => {
    setAudited((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const checkCustom = async () => {
    if (!customPassword) return;
    setCustomChecking(true);
    setCustomPwned(null);
    try {
      const result = await checkPasswordPwned(customPassword);
      setCustomPwned(result);
      if (result.pwned) {
        toast.error(`Senha vazada ${result.count.toLocaleString("pt-BR")} vezes!`);
      } else {
        toast.success("Senha não encontrada em vazamentos conhecidos");
      }
    } catch {
      toast.error("Erro ao consultar HIBP");
    } finally {
      setCustomChecking(false);
    }
  };

  const getStrengthLabel = (s: number) => (s >= 100 ? "Excelente" : s >= 80 ? "Forte" : s >= 60 ? "Moderada" : s >= 40 ? "Fraca" : "Muito Fraca");
  const getStrengthColor = (s: number) => (s >= 80 ? "text-success" : s >= 60 ? "text-warning" : "text-destructive");
  const getStrengthBg = (s: number) => (s >= 80 ? "bg-success" : s >= 60 ? "bg-warning" : "bg-destructive");

  const copyPassword = (p: string) => {
    navigator.clipboard.writeText(p);
    toast.success("Senha copiada!");
  };

  const generateAndFill = () => {
    const p = generateStrongPassword();
    setNewPassword(p);
    toast.success("Senha forte gerada");
  };

  const generateAndCopy = () => {
    const p = generateStrongPassword();
    setCustomPassword(p);
    navigator.clipboard.writeText(p);
    setCustomPwned(null);
    toast.success("Senha forte gerada e copiada!");
  };

  const togglePasswordVisibility = (id: string) => setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));

  const customAnalysis = customPassword ? analyzeReal(customPassword) : null;
  const weakCount = audited.filter((p) => p.strength < 80 || p.pwned).length;

  return (
    <div className="space-y-6">
      {/* Privacy note */}
      <motion.div
        className="glass-card p-4 flex items-start gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Suas senhas <strong className="text-foreground">nunca saem do seu dispositivo</strong>.
          Usamos <strong className="text-foreground">k-anonimidade</strong>: só os 5 primeiros caracteres do hash SHA-1
          são enviados ao <strong className="text-foreground">Have I Been Pwned</strong> para verificar vazamentos reais.
        </p>
      </motion.div>

      {/* Add password to audit */}
      <motion.div
        className="glass-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/20">
            <Search className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Auditar Senha</h3>
            <p className="text-sm text-muted-foreground">Adicione uma senha para análise completa</p>
          </div>
        </div>

        <div className="space-y-3">
          <Input
            placeholder="Nome do serviço (ex: Gmail)"
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
            className="h-12 bg-secondary border-border"
          />
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              placeholder="Senha do serviço"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pr-20 h-12 bg-secondary border-border"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => setShowNew(!showNew)} className="h-8 w-8">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={generateAndFill} className="h-8 w-8" title="Gerar senha forte">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Button onClick={addPassword} disabled={adding} className="w-full" size="lg">
            {adding ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Verificando vazamento...</>
            ) : (
              <><Plus className="w-5 h-5" /> Auditar Senha</>
            )}
          </Button>
        </div>
      </motion.div>

      {/* CSV import from browser vault */}
      <PasswordCsvImport
        onImport={(items) => {
          const now = Date.now();
          const newEntries: AuditedPassword[] = items.map((it, i) => {
            const audit = buildAudit(it.service, it.password);
            return {
              id: `${now}-${i}-${crypto.randomUUID()}`,
              service: it.service,
              password: it.password,
              ...audit,
              pwned: it.pwned,
              pwnedCount: it.count,
              checking: false,
            };
          });
          setAudited((prev) => [...newEntries, ...prev]);
        }}
      />

      {/* Risk summary (reuse + weakness) */}
      <PasswordRiskSummary entries={audited} />

      {/* Audited list */}
      <AnimatePresence>
        {audited.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Senhas Auditadas</h3>
              <span className="text-sm text-muted-foreground">
                {audited.length - weakCount}/{audited.length} seguras
              </span>
            </div>

            <div className="space-y-3">
              {audited.map((pw, index) => (
                <motion.div
                  key={pw.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    pw.pwned
                      ? "bg-destructive/10 border-destructive/30 hover:bg-destructive/15"
                      : pw.strength >= 80
                        ? "bg-success/5 border-success/20 hover:bg-success/10"
                        : pw.strength >= 60
                          ? "bg-warning/5 border-warning/20 hover:bg-warning/10"
                          : "bg-destructive/5 border-destructive/20 hover:bg-destructive/10"
                  }`}
                  onClick={() => setSelectedId(selectedId === pw.id ? null : pw.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        pw.pwned ? "bg-destructive/20" : pw.strength >= 80 ? "bg-success/20" : pw.strength >= 60 ? "bg-warning/20" : "bg-destructive/20"
                      }`}>
                        {pw.checking ? (
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        ) : pw.pwned ? (
                          <ShieldAlert className="w-4 h-4 text-destructive" />
                        ) : pw.strength >= 80 ? (
                          <CheckCircle className={`w-4 h-4 ${getStrengthColor(pw.strength)}`} />
                        ) : (
                          <AlertTriangle className={`w-4 h-4 ${getStrengthColor(pw.strength)}`} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">{pw.service}</p>
                          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${CRITICALITY_COLOR[pw.criticality]} border-current/30`}>
                            {CRITICALITY_LABEL[pw.criticality]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground font-mono truncate">
                            {showPasswords[pw.id] ? pw.password : "••••••••"}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(pw.id); }}
                            className="p-1 hover:bg-muted rounded flex-shrink-0"
                          >
                            {showPasswords[pw.id] ? <EyeOff className="w-3 h-3 text-muted-foreground" /> : <Eye className="w-3 h-3 text-muted-foreground" />}
                          </button>
                        </div>
                        {!pw.checking && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Quebra estimada: <span className="text-foreground">{pw.crackTime}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-medium ${pw.pwned ? "text-destructive" : getStrengthColor(pw.strength)}`}>
                        {pw.pwned ? "Vazada" : getStrengthLabel(pw.strength)}
                      </span>
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${selectedId === pw.id ? "rotate-90" : ""}`} />
                    </div>
                  </div>

                  <AnimatePresence>
                    {selectedId === pw.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-border space-y-3"
                      >
                        {pw.pwned && (
                          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <div className="flex items-center gap-2 mb-1">
                              <ShieldAlert className="w-4 h-4 text-destructive" />
                              <span className="text-sm font-semibold text-destructive">Encontrada em vazamentos</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Esta senha aparece <strong className="text-destructive">{pw.pwnedCount.toLocaleString("pt-BR")}</strong> vezes
                              em bases de dados públicas. Troque imediatamente.
                            </p>
                          </div>
                        )}

                        {pw.suggestions.length > 0 && (
                          <>
                            <div className="flex items-center gap-2">
                              <Lightbulb className="w-4 h-4 text-warning" />
                              <span className="text-sm font-medium text-foreground">Sugestões de Correção</span>
                            </div>
                            <ul className="space-y-2">
                              {pw.suggestions.map((s, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                  <span className="text-primary">•</span>{s}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              const p = generateStrongPassword();
                              navigator.clipboard.writeText(p);
                              toast.success(`Senha forte para ${pw.service} copiada!`);
                            }}
                          >
                            <RefreshCw className="w-4 h-4" />Nova senha forte
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); removePassword(pw.id); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom check */}
      <motion.div
        className="glass-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-accent/20">
            <Lock className="w-5 h-5 text-accent" />
          </div>
          <h3 className="font-semibold text-foreground">Verificação Rápida</h3>
        </div>

        <div className="relative mb-4">
          <Input
            type={showCustomPassword ? "text" : "password"}
            value={customPassword}
            onChange={(e) => { setCustomPassword(e.target.value); setCustomPwned(null); }}
            placeholder="Digite uma senha..."
            className="pr-20 h-12 bg-secondary border-border"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowCustomPassword(!showCustomPassword)} className="h-8 w-8">
              {showCustomPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            {customPassword && (
              <Button variant="ghost" size="icon" onClick={() => copyPassword(customPassword)} className="h-8 w-8">
                <Copy className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {customAnalysis && customPassword && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${getStrengthColor(customAnalysis.strength)}`}>
                {getStrengthLabel(customAnalysis.strength)}
              </span>
              <span className={`text-sm font-mono ${getStrengthColor(customAnalysis.strength)}`}>
                {Math.round(customAnalysis.strength)}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${getStrengthBg(customAnalysis.strength)}`}
                initial={{ width: 0 }}
                animate={{ width: `${customAnalysis.strength}%` }}
              />
            </div>

            {customPwned && (
              <div className={`mt-3 p-3 rounded-lg border ${customPwned.pwned ? "bg-destructive/10 border-destructive/20" : "bg-success/10 border-success/20"}`}>
                <div className="flex items-center gap-2">
                  {customPwned.pwned ? <ShieldAlert className="w-4 h-4 text-destructive" /> : <CheckCircle className="w-4 h-4 text-success" />}
                  <span className={`text-sm font-semibold ${customPwned.pwned ? "text-destructive" : "text-success"}`}>
                    {customPwned.pwned
                      ? `Vazada ${customPwned.count.toLocaleString("pt-BR")} vezes`
                      : "Não encontrada em vazamentos"}
                  </span>
                </div>
              </div>
            )}

            {customAnalysis.suggestions.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-sm font-medium text-warning mb-2">Sugestões:</p>
                <ul className="space-y-1">
                  {customAnalysis.suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-warning">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        <div className="flex gap-2">
          <Button onClick={checkCustom} disabled={!customPassword || customChecking} className="flex-1">
            {customChecking ? <><Loader2 className="w-4 h-4 animate-spin" />Verificando...</> : <><Shield className="w-4 h-4" />Verificar Vazamento</>}
          </Button>
          <Button variant="outline" onClick={generateAndCopy}>
            <RefreshCw className="w-4 h-4" />Gerar
          </Button>
        </div>
      </motion.div>

      {/* Tips */}
      <motion.div
        className="glass-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h4 className="font-semibold text-foreground mb-3">Dicas de Segurança</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />Use senhas diferentes para cada conta</li>
          <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />Prefira frases-passe longas (14+ caracteres)</li>
          <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />Use um gerenciador de senhas confiável</li>
          <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />Ative autenticação de dois fatores (2FA)</li>
        </ul>
      </motion.div>
    </div>
  );
}
