import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileWarning, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { checkPasswordPwned } from "@/lib/hibp";

export interface ImportedEntry {
  service: string;
  password: string;
}

interface Props {
  onImport: (entries: Array<ImportedEntry & { pwned: boolean; count: number }>) => void;
}

// Parses a single CSV line respecting quoted fields (RFC-4180-ish)
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): ImportedEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

  // Detect Chrome/Edge/Firefox/Brave/Safari common columns
  const nameIdx = header.findIndex((h) => ["name", "title"].includes(h));
  const urlIdx = header.findIndex((h) => ["url", "web site", "website", "login_uri", "hostname"].includes(h));
  const passIdx = header.findIndex((h) => ["password", "login_password"].includes(h));

  if (passIdx === -1) return [];

  const entries: ImportedEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const password = cols[passIdx];
    if (!password) continue;
    let service =
      (nameIdx !== -1 && cols[nameIdx]) ||
      (urlIdx !== -1 && cols[urlIdx]) ||
      "Serviço";
    try {
      if (service.startsWith("http")) service = new URL(service).hostname.replace(/^www\./, "");
    } catch { /* keep raw */ }
    entries.push({ service: service.trim(), password });
  }
  return entries;
}

export function PasswordCsvImport({ onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 5MB)");
      return;
    }
    const text = await file.text();
    const entries = parseCsv(text);
    if (entries.length === 0) {
      toast.error("Nenhuma senha encontrada. Exporte o CSV do seu navegador.");
      return;
    }

    setBusy(true);
    setProgress({ done: 0, total: entries.length });
    const results: Array<ImportedEntry & { pwned: boolean; count: number }> = [];

    // Throttle: 6 concurrent HIBP requests
    const concurrency = 6;
    let idx = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (idx < entries.length) {
        const i = idx++;
        const e = entries[i];
        try {
          const r = await checkPasswordPwned(e.password);
          results[i] = { ...e, pwned: r.pwned, count: r.count };
        } catch {
          results[i] = { ...e, pwned: false, count: 0 };
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    });
    await Promise.all(workers);

    onImport(results.filter(Boolean));
    setBusy(false);
    setProgress({ done: 0, total: 0 });

    const leaked = results.filter((r) => r.pwned).length;
    if (leaked > 0) toast.error(`${leaked} senhas vazadas encontradas!`);
    else toast.success(`${results.length} senhas auditadas — nenhuma em vazamentos`);
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  const [dragOver, setDragOver] = useState(false);

  return (
    <motion.div
      className={`glass-card p-6 cursor-pointer transition-all ${
        dragOver ? "border-primary bg-primary/5 ring-2 ring-primary/40" : ""
      } ${busy ? "cursor-wait opacity-90" : "hover:border-primary/40"}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => !busy && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (busy) return;
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !busy) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-accent/20">
          <Upload className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Importar cofre do navegador</h3>
          <p className="text-sm text-muted-foreground">
            {dragOver ? "Solte o arquivo aqui" : "Clique em qualquer lugar ou arraste um CSV"}
          </p>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-secondary/40 border border-border mb-4 flex items-start gap-2">
        <FileWarning className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
          <p><strong className="text-foreground">Como exportar:</strong></p>
          <p>• <strong>Chrome/Edge/Brave:</strong> abra <code className="text-primary">chrome://password-manager/settings</code> → Exportar senhas</p>
          <p>• <strong>Firefox:</strong> <code className="text-primary">about:logins</code> → menu ⋯ → Exportar</p>
          <p>• <strong>Safari:</strong> Arquivo → Exportar → Senhas</p>
          <p className="pt-1 text-success flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> O arquivo é lido apenas no seu dispositivo e descartado após a auditoria.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <div
        className={`w-full h-12 rounded-md border-2 border-dashed flex items-center justify-center text-sm font-medium ${
          busy ? "border-primary/30 text-muted-foreground" : "border-primary/40 text-primary"
        }`}
      >
        {busy ? (
          <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Auditando {progress.done}/{progress.total} ({pct}%)</>
        ) : (
          <><Upload className="w-5 h-5 mr-2" /> Clique ou arraste o CSV aqui</>
        )}
      </div>
    </motion.div>
  );
}
