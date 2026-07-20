import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  Clock,
  Link2,
  FileText,
  RotateCw,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  subscribe,
  removeJob,
  clearFinished,
  clearAll,
  retryJob,
  enqueueFileScan,
  type ScanJob,
} from "@/lib/scanQueue";

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatBytes(n?: number) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function verdictStyle(job: ScanJob) {
  if (job.status === "running") return "border-primary/40 bg-primary/5";
  if (job.status === "queued") return "border-muted bg-muted/20";
  if (job.status === "failed") return "border-destructive/30 bg-destructive/5";
  switch (job.verdict) {
    case "malicious":
      return "border-destructive/40 bg-destructive/5";
    case "suspicious":
      return "border-warning/40 bg-warning/5";
    case "clean":
      return "border-success/30 bg-success/5";
    default:
      return "border-muted bg-muted/10";
  }
}

function StatusIcon({ job }: { job: ScanJob }) {
  if (job.status === "queued") return <Clock className="w-4 h-4 text-muted-foreground" />;
  if (job.status === "running") return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
  if (job.status === "failed") return <AlertCircle className="w-4 h-4 text-destructive" />;
  if (job.verdict === "malicious") return <ShieldAlert className="w-4 h-4 text-destructive" />;
  if (job.verdict === "suspicious") return <AlertCircle className="w-4 h-4 text-warning" />;
  return <CheckCircle className="w-4 h-4 text-success" />;
}

export function ScanQueueHistory() {
  const [jobs, setJobs] = useState<ScanJob[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => subscribe(setJobs), []);

  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const history = jobs.filter((j) => j.status === "completed" || j.status === "failed");

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => enqueueFileScan(f));
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="glass-card p-4 space-y-4 border-primary/20">
      <div className="flex items-center gap-2 flex-wrap">
        <FileText className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Fila & Histórico de Scans</h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
          PERSISTENTE
        </span>
        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInput.current?.click()}
            className="h-8 text-xs"
          >
            <Upload className="w-3.5 h-3.5 mr-1" />
            Arquivo
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        URLs e arquivos são processados um por vez. Todo o histórico fica salvo no seu dispositivo.
      </p>

      {/* Active queue */}
      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Em andamento ({active.length})
          </p>
          <AnimatePresence initial={false}>
            {active.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* History */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Histórico ({history.length})
          </p>
          {jobs.length > 0 && (
            <div className="flex gap-1">
              {history.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearFinished}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpar finalizados
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={clearAll}
                className="h-7 text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Tudo
              </Button>
            </div>
          )}
        </div>

        {history.length === 0 && active.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
            Nenhum scan realizado ainda.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {history.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function JobRow({ job }: { job: ScanJob }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`p-3 rounded-lg border ${verdictStyle(job)}`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5">
          <StatusIcon job={job} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {job.kind === "url" ? (
              <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-medium text-foreground truncate">
              {job.target}
            </span>
            {job.size ? (
              <span className="text-[10px] text-muted-foreground">
                {formatBytes(job.size)}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {job.status === "queued" && "Aguardando processamento..."}
            {job.status === "running" && "Analisando..."}
            {job.status === "failed" && (job.error || "Falha na análise")}
            {job.status === "completed" && job.summary}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 font-mono">
            {formatTime(job.createdAt)}
            {job.finishedAt && ` · ${((job.finishedAt - (job.startedAt || job.createdAt)) / 1000).toFixed(1)}s`}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {job.status === "failed" && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => retryJob(job.id)}
              title="Tentar novamente"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => removeJob(job.id)}
            title="Remover"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
