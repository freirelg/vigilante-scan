import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, Shield, AlertTriangle, CheckCircle, X, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface PasswordCheck {
  label: string;
  passed: boolean;
}

export function PasswordAnalyzer() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  const analyzePassword = () => {
    const checks: PasswordCheck[] = [
      { label: "Mínimo 8 caracteres", passed: password.length >= 8 },
      { label: "Letra maiúscula", passed: /[A-Z]/.test(password) },
      { label: "Letra minúscula", passed: /[a-z]/.test(password) },
      { label: "Número", passed: /[0-9]/.test(password) },
      { label: "Caractere especial", passed: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
      { label: "Sem sequências comuns", passed: !/(123|abc|qwerty|password)/i.test(password) },
    ];
    return checks;
  };

  const checks = analyzePassword();
  const passedChecks = checks.filter((c) => c.passed).length;
  const strength = (passedChecks / checks.length) * 100;

  const getStrengthLabel = () => {
    if (strength >= 100) return "Excelente";
    if (strength >= 80) return "Forte";
    if (strength >= 60) return "Moderada";
    if (strength >= 40) return "Fraca";
    return "Muito Fraca";
  };

  const getStrengthColor = () => {
    if (strength >= 80) return "text-success";
    if (strength >= 60) return "text-warning";
    return "text-destructive";
  };

  const getStrengthBg = () => {
    if (strength >= 80) return "bg-success";
    if (strength >= 60) return "bg-warning";
    return "bg-destructive";
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let newPassword = "";
    for (let i = 0; i < 16; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(newPassword);
    setAnalyzed(true);
    toast.success("Senha forte gerada!");
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(password);
    toast.success("Senha copiada!");
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <motion.div
        className="glass-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/20">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">Analisar Senha</h3>
        </div>

        <div className="relative mb-4">
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setAnalyzed(true);
            }}
            placeholder="Digite sua senha..."
            className="pr-20 h-14 text-lg bg-secondary border-border"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword(!showPassword)}
              className="h-10 w-10"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
            {password && (
              <Button
                variant="ghost"
                size="icon"
                onClick={copyPassword}
                className="h-10 w-10"
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          onClick={generatePassword}
          className="w-full"
        >
          <RefreshCw className="w-4 h-4" />
          Gerar Senha Forte
        </Button>
      </motion.div>

      {/* Strength Meter */}
      <AnimatePresence>
        {analyzed && password && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${strength >= 80 ? "bg-success/20" : strength >= 60 ? "bg-warning/20" : "bg-destructive/20"}`}>
                  {strength >= 80 ? (
                    <Shield className={`w-5 h-5 ${getStrengthColor()}`} />
                  ) : (
                    <AlertTriangle className={`w-5 h-5 ${getStrengthColor()}`} />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground">Força da Senha</p>
                  <p className={`text-sm ${getStrengthColor()}`}>{getStrengthLabel()}</p>
                </div>
              </div>
              <span className={`text-2xl font-bold font-mono ${getStrengthColor()}`}>
                {Math.round(strength)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-muted rounded-full overflow-hidden mb-6">
              <motion.div
                className={`h-full ${getStrengthBg()}`}
                initial={{ width: 0 }}
                animate={{ width: `${strength}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Checklist */}
            <div className="space-y-3">
              {checks.map((check, index) => (
                <motion.div
                  key={check.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    check.passed ? "bg-success/10" : "bg-destructive/10"
                  }`}
                >
                  {check.passed ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <X className="w-5 h-5 text-destructive" />
                  )}
                  <span className={check.passed ? "text-success" : "text-destructive"}>
                    {check.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tips */}
      <motion.div
        className="glass-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h4 className="font-semibold text-foreground mb-3">Dicas de Segurança</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            Use senhas diferentes para cada conta
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            Evite informações pessoais na senha
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            Considere usar um gerenciador de senhas
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            Ative autenticação de dois fatores
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
