import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Eye, EyeOff, Lock, Shield, AlertTriangle, CheckCircle, X, 
  Copy, RefreshCw, Search, Lightbulb, ChevronRight 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface PasswordCheck {
  label: string;
  passed: boolean;
  suggestion?: string;
}

interface SavedPassword {
  id: string;
  service: string;
  password: string;
  strength: number;
  issues: string[];
  suggestions: string[];
}

const analyzePasswordStrength = (password: string) => {
  const checks: PasswordCheck[] = [
    { 
      label: "Mínimo 8 caracteres", 
      passed: password.length >= 8,
      suggestion: "Adicione mais caracteres para aumentar a segurança"
    },
    { 
      label: "Letra maiúscula", 
      passed: /[A-Z]/.test(password),
      suggestion: "Inclua pelo menos uma letra maiúscula (A-Z)"
    },
    { 
      label: "Letra minúscula", 
      passed: /[a-z]/.test(password),
      suggestion: "Inclua pelo menos uma letra minúscula (a-z)"
    },
    { 
      label: "Número", 
      passed: /[0-9]/.test(password),
      suggestion: "Adicione números para fortalecer a senha"
    },
    { 
      label: "Caractere especial", 
      passed: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      suggestion: "Use caracteres especiais como !@#$%&*"
    },
    { 
      label: "Sem sequências comuns", 
      passed: !/(123|abc|qwerty|password|senha)/i.test(password),
      suggestion: "Evite sequências previsíveis como 123, abc ou 'senha'"
    },
  ];
  
  const passedChecks = checks.filter((c) => c.passed).length;
  const strength = (passedChecks / checks.length) * 100;
  const issues = checks.filter(c => !c.passed).map(c => c.label);
  const suggestions = checks.filter(c => !c.passed && c.suggestion).map(c => c.suggestion!);
  
  return { checks, strength, issues, suggestions };
};

const generateStrongPassword = () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Simulated saved passwords (in a real app, these would come from a secure storage)
const mockSavedPasswords: Omit<SavedPassword, "strength" | "issues" | "suggestions">[] = [
  { id: "1", service: "Gmail", password: "senha123" },
  { id: "2", service: "Facebook", password: "Fb@2024Secure!" },
  { id: "3", service: "Instagram", password: "insta2024" },
  { id: "4", service: "Banco Digital", password: "MinhaSenha" },
  { id: "5", service: "Netflix", password: "N3tfl!x@2024#" },
  { id: "6", service: "Amazon", password: "amazon123" },
];

export function PasswordAnalyzer() {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [savedPasswords, setSavedPasswords] = useState<SavedPassword[]>([]);
  const [selectedPassword, setSelectedPassword] = useState<SavedPassword | null>(null);
  const [customPassword, setCustomPassword] = useState("");
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const scanPasswords = async () => {
    setScanning(true);
    setScanned(false);
    setSavedPasswords([]);
    
    // Simulate scanning delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const analyzed = mockSavedPasswords.map(pw => {
      const analysis = analyzePasswordStrength(pw.password);
      return {
        ...pw,
        strength: analysis.strength,
        issues: analysis.issues,
        suggestions: analysis.suggestions,
      };
    });
    
    setSavedPasswords(analyzed);
    setScanning(false);
    setScanned(true);
    
    const weakCount = analyzed.filter(p => p.strength < 80).length;
    if (weakCount > 0) {
      toast.warning(`${weakCount} senha(s) precisam de atenção!`);
    } else {
      toast.success("Todas as senhas estão seguras!");
    }
  };

  const getStrengthLabel = (strength: number) => {
    if (strength >= 100) return "Excelente";
    if (strength >= 80) return "Forte";
    if (strength >= 60) return "Moderada";
    if (strength >= 40) return "Fraca";
    return "Muito Fraca";
  };

  const getStrengthColor = (strength: number) => {
    if (strength >= 80) return "text-success";
    if (strength >= 60) return "text-warning";
    return "text-destructive";
  };

  const getStrengthBg = (strength: number) => {
    if (strength >= 80) return "bg-success";
    if (strength >= 60) return "bg-warning";
    return "bg-destructive";
  };

  const copyPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    toast.success("Senha copiada!");
  };

  const generateAndCopy = () => {
    const newPassword = generateStrongPassword();
    setCustomPassword(newPassword);
    navigator.clipboard.writeText(newPassword);
    toast.success("Senha forte gerada e copiada!");
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const customAnalysis = customPassword ? analyzePasswordStrength(customPassword) : null;

  return (
    <div className="space-y-6">
      {/* Scan Button */}
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
            <h3 className="font-semibold text-foreground">Analisar Senhas do Dispositivo</h3>
            <p className="text-sm text-muted-foreground">Verifique a segurança das suas senhas salvas</p>
          </div>
        </div>

        <Button
          onClick={scanPasswords}
          disabled={scanning}
          className="w-full"
          size="lg"
        >
          {scanning ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Analisando senhas...
            </>
          ) : (
            <>
              <Shield className="w-5 h-5" />
              {scanned ? "Analisar Novamente" : "Iniciar Análise"}
            </>
          )}
        </Button>
      </motion.div>

      {/* Scan Results */}
      <AnimatePresence>
        {scanned && savedPasswords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Senhas Encontradas</h3>
              <span className="text-sm text-muted-foreground">
                {savedPasswords.filter(p => p.strength >= 80).length}/{savedPasswords.length} seguras
              </span>
            </div>

            <div className="space-y-3">
              {savedPasswords.map((pw, index) => (
                <motion.div
                  key={pw.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    pw.strength >= 80 
                      ? "bg-success/5 border-success/20 hover:bg-success/10" 
                      : pw.strength >= 60 
                        ? "bg-warning/5 border-warning/20 hover:bg-warning/10"
                        : "bg-destructive/5 border-destructive/20 hover:bg-destructive/10"
                  }`}
                  onClick={() => setSelectedPassword(selectedPassword?.id === pw.id ? null : pw)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        pw.strength >= 80 ? "bg-success/20" : pw.strength >= 60 ? "bg-warning/20" : "bg-destructive/20"
                      }`}>
                        {pw.strength >= 80 ? (
                          <CheckCircle className={`w-4 h-4 ${getStrengthColor(pw.strength)}`} />
                        ) : (
                          <AlertTriangle className={`w-4 h-4 ${getStrengthColor(pw.strength)}`} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{pw.service}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground font-mono">
                            {showPasswords[pw.id] ? pw.password : "••••••••"}
                          </span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(pw.id); }}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {showPasswords[pw.id] ? (
                              <EyeOff className="w-3 h-3 text-muted-foreground" />
                            ) : (
                              <Eye className="w-3 h-3 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getStrengthColor(pw.strength)}`}>
                        {getStrengthLabel(pw.strength)}
                      </span>
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${
                        selectedPassword?.id === pw.id ? "rotate-90" : ""
                      }`} />
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {selectedPassword?.id === pw.id && pw.suggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-border"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Lightbulb className="w-4 h-4 text-warning" />
                          <span className="text-sm font-medium text-foreground">Sugestões de Correção</span>
                        </div>
                        <ul className="space-y-2">
                          {pw.suggestions.map((suggestion, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="text-primary">•</span>
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newPw = generateStrongPassword();
                            navigator.clipboard.writeText(newPw);
                            toast.success(`Senha forte sugerida para ${pw.service}: copiada!`);
                          }}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Gerar Nova Senha Forte
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Password Check */}
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
          <h3 className="font-semibold text-foreground">Verificar Outra Senha</h3>
        </div>

        <div className="relative mb-4">
          <Input
            type={showCustomPassword ? "text" : "password"}
            value={customPassword}
            onChange={(e) => setCustomPassword(e.target.value)}
            placeholder="Digite uma senha para verificar..."
            className="pr-20 h-12 bg-secondary border-border"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCustomPassword(!showCustomPassword)}
              className="h-8 w-8"
            >
              {showCustomPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            {customPassword && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyPassword(customPassword)}
                className="h-8 w-8"
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Custom Password Analysis */}
        {customAnalysis && customPassword && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
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

        <Button variant="outline" onClick={generateAndCopy} className="w-full">
          <RefreshCw className="w-4 h-4" />
          Gerar Senha Forte
        </Button>
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
