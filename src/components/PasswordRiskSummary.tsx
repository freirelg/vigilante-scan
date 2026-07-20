import { useMemo } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, ShieldCheck, Repeat, KeyRound, AlertTriangle, Lightbulb, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface RiskInputEntry {
  id: string;
  service: string;
  password: string;
  strength: number;
  pwned: boolean;
  checking: boolean;
}

interface ReuseGroup {
  fingerprint: string; // masked (never shows plaintext)
  services: string[];
  pwned: boolean;
  strength: number;
}

interface Summary {
  total: number;
  ready: number;
  weak: number;         // strength < 60
  moderate: number;     // 60-79
  strong: number;       // >=80
  pwned: number;
  reused: number;       // count of passwords used in >1 service
  reuseGroups: ReuseGroup[];
  avgStrength: number;
  riskScore: number;    // 0-100 (lower is safer)
  riskLevel: "baixo" | "medio" | "alto";
  recommendations: string[];
}

function maskFingerprint(pw: string): string {
  if (!pw) return "••••";
  const head = pw.slice(0, 1);
  return `${head}${"•".repeat(Math.min(6, Math.max(3, pw.length - 2)))}${pw.length}`;
}

function computeSummary(entries: RiskInputEntry[]): Summary {
  const ready = entries.filter((e) => !e.checking);
  const total = entries.length;

  const weak = ready.filter((e) => e.strength < 60).length;
  const moderate = ready.filter((e) => e.strength >= 60 && e.strength < 80).length;
  const strong = ready.filter((e) => e.strength >= 80).length;
  const pwned = ready.filter((e) => e.pwned).length;

  // Reuse detection: group by plaintext (already in local memory)
  const byPw = new Map<string, RiskInputEntry[]>();
  for (const e of ready) {
    if (!byPw.has(e.password)) byPw.set(e.password, []);
    byPw.get(e.password)!.push(e);
  }
  const reuseGroups: ReuseGroup[] = [];
  let reused = 0;
  for (const [pw, list] of byPw) {
    if (list.length > 1) {
      reused += list.length;
      reuseGroups.push({
        fingerprint: maskFingerprint(pw),
        services: list.map((l) => l.service),
        pwned: list.some((l) => l.pwned),
        strength: list[0].strength,
      });
    }
  }

  const avgStrength = ready.length
    ? ready.reduce((s, e) => s + e.strength, 0) / ready.length
    : 0;

  // Risk score (0 safest, 100 riskiest)
  // Weights: pwned 45, reuse 25, weakness 20, inv-avg-strength 10
  let risk = 0;
  if (ready.length > 0) {
    risk += 45 * (pwned / ready.length);
    risk += 25 * (reused / ready.length);
    risk += 20 * (weak / ready.length);
    risk += 10 * (1 - avgStrength / 100);
  }
  risk = Math.round(Math.min(100, Math.max(0, risk)));
  const riskLevel: Summary["riskLevel"] = risk >= 60 ? "alto" : risk >= 30 ? "medio" : "baixo";

  // Recommendations (specific, ordered by impact)
  const recommendations: string[] = [];
  if (pwned > 0) recommendations.push(`Troque imediatamente as ${pwned} senha(s) encontradas em vazamentos.`);
  if (reuseGroups.length > 0) {
    recommendations.push(
      `Você reutiliza ${reuseGroups.length} senha(s) em ${reused} serviços — crie uma única e diferente para cada conta.`,
    );
  }
  if (weak > 0) recommendations.push(`${weak} senha(s) fracas — use ao menos 14 caracteres com símbolos e números.`);
  if (moderate > 0) recommendations.push(`${moderate} senha(s) moderadas — reforce com caracteres especiais.`);
  if (ready.length > 0 && avgStrength < 80) recommendations.push("Considere um gerenciador de senhas para gerar credenciais únicas.");
  if (ready.length > 0) recommendations.push("Ative autenticação em dois fatores (2FA) em todos os serviços críticos.");
  if (recommendations.length === 0 && ready.length > 0) {
    recommendations.push("Excelente higiene de senhas — mantenha o hábito de rotação periódica (a cada 6-12 meses).");
  }

  return {
    total, ready: ready.length, weak, moderate, strong, pwned,
    reused, reuseGroups, avgStrength, riskScore: risk, riskLevel, recommendations,
  };
}

export function PasswordRiskSummary({ entries }: { entries: RiskInputEntry[] }) {
  const s = useMemo(() => computeSummary(entries), [entries]);

  if (s.total === 0) return null;

  const tone =
    s.riskLevel === "alto" ? "destructive"
    : s.riskLevel === "medio" ? "warning"
    : "success";
  const toneClass =
    tone === "destructive" ? "text-destructive bg-destructive/10 border-destructive/30"
    : tone === "warning" ? "text-warning bg-warning/10 border-warning/30"
    : "text-success bg-success/10 border-success/30";
  const barClass =
    tone === "destructive" ? "bg-destructive"
    : tone === "warning" ? "bg-warning"
    : "bg-success";

  const levelLabel =
    s.riskLevel === "alto" ? "Alto"
    : s.riskLevel === "medio" ? "Médio"
    : "Baixo";

  return (
    <motion.div
      className="glass-card p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2 rounded-lg border ${toneClass}`}>
          {s.riskLevel === "alto" ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-foreground">Resumo de Risco</h3>
            <Badge variant="outline" className={`text-[10px] ${toneClass}`}>
              Risco {levelLabel} • {s.riskScore}/100
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Cálculo local com base em vazamentos (HIBP), reutilização e força das senhas auditadas.
          </p>
        </div>
      </div>

      {/* Risk bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
        <motion.div
          className={`h-full ${barClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${s.riskScore}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <StatCell
          icon={<KeyRound className="w-3.5 h-3.5" />}
          label="Auditadas"
          value={`${s.ready}/${s.total}`}
          tone="neutral"
        />
        <StatCell
          icon={<ShieldAlert className="w-3.5 h-3.5" />}
          label="Vazadas"
          value={String(s.pwned)}
          tone={s.pwned > 0 ? "destructive" : "success"}
        />
        <StatCell
          icon={<Repeat className="w-3.5 h-3.5" />}
          label="Reutilizadas"
          value={String(s.reused)}
          tone={s.reused > 0 ? "warning" : "success"}
        />
        <StatCell
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          label="Fracas"
          value={String(s.weak)}
          tone={s.weak > 0 ? "warning" : "success"}
        />
      </div>

      {/* Strength distribution */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Distribuição de força
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            média {Math.round(s.avgStrength)}%
          </span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
          {s.ready > 0 && (
            <>
              <div className="bg-success" style={{ width: `${(s.strong / s.ready) * 100}%` }} />
              <div className="bg-warning" style={{ width: `${(s.moderate / s.ready) * 100}%` }} />
              <div className="bg-destructive" style={{ width: `${(s.weak / s.ready) * 100}%` }} />
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-success" /> Fortes: {s.strong}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-warning" /> Moderadas: {s.moderate}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-destructive" /> Fracas: {s.weak}</span>
        </div>
      </div>

      {/* Reuse groups */}
      {s.reuseGroups.length > 0 && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Repeat className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium text-warning">
              Reutilização detectada ({s.reuseGroups.length} grupo{s.reuseGroups.length > 1 ? "s" : ""})
            </span>
          </div>
          <ul className="space-y-1.5">
            {s.reuseGroups.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono flex-shrink-0">
                  {g.fingerprint}
                </code>
                <div className="min-w-0">
                  <p className="text-foreground truncate">
                    {g.services.join(" · ")}
                  </p>
                  {g.pwned && (
                    <p className="text-[10px] text-destructive">⚠ Também está em vazamentos</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground/70 mt-2">
            Identificação por impressão local — a senha em texto não é exibida.
          </p>
        </div>
      )}

      {/* Recommendations */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Recomendações de melhoria</span>
        </div>
        <ul className="space-y-1.5">
          {s.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="text-primary mt-0.5">→</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

function StatCell({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "neutral" | "success" | "warning" | "destructive";
}) {
  const cls =
    tone === "success" ? "border-success/30 text-success"
    : tone === "warning" ? "border-warning/30 text-warning"
    : tone === "destructive" ? "border-destructive/30 text-destructive"
    : "border-border text-foreground";
  return (
    <div className={`rounded-lg border bg-muted/20 p-2 ${cls}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80">
        {icon}{label}
      </div>
      <p className="text-lg font-semibold font-mono tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
