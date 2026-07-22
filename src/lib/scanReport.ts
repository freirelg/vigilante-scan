import jsPDF from "jspdf";
import { getScanHistory } from "@/lib/scanHistory";

export interface ScanThreatSnapshot {
  id: string;
  name: string;
  type: "malware" | "adware" | "spyware" | "trojan";
  severity: "low" | "medium" | "high";
  location: string;
  status: "detected" | "quarantined" | "removed";
}

export interface ScanResultSnapshot {
  category: string;
  status: "safe" | "warning" | "danger";
  message: string;
  count: number;
}

export interface LastScanSnapshot {
  date: string; // ISO
  hostsScanned: number;
  threats: ScanThreatSnapshot[];
  results: ScanResultSnapshot[];
}

const KEY = "freirenet_last_scan_v1";

export function saveLastScan(snap: LastScanSnapshot) {
  try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch {}
}

export function getLastScan(): LastScanSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LastScanSnapshot) : null;
  } catch { return null; }
}

const SEVERITY_LABEL: Record<ScanThreatSnapshot["severity"], string> = {
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

const TYPE_LABEL: Record<ScanThreatSnapshot["type"], string> = {
  malware: "Malware",
  adware: "Adware",
  spyware: "Spyware",
  trojan: "Trojan",
};

function recommendationsFor(t: ScanThreatSnapshot): string[] {
  const recs: string[] = [];
  if (t.severity === "high") {
    recs.push("Bloquear a origem imediatamente (Remover) e evitar qualquer interação com o host.");
    recs.push("Trocar senhas usadas em serviços que se comunicaram com esta origem.");
  }
  if (t.type === "adware") {
    recs.push("Auditar extensões/scripts de terceiros carregados pela página.");
  }
  if (t.type === "spyware" || t.type === "trojan") {
    recs.push("Executar varredura profunda com antivírus do sistema operacional.");
    recs.push("Revisar tokens de sessão e revogar sessões ativas.");
  }
  if (t.type === "malware") {
    recs.push("Purgar caches do navegador e do Service Worker.");
  }
  if (t.status !== "removed") {
    recs.push("Adicionar host à lista de bloqueio permanente.");
  }
  return recs;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "medium" });
  } catch { return iso; }
}

// ---------- Text/Markdown report ----------
export function buildTextReport(): string {
  const snap = getLastScan();
  const history = getScanHistory();
  const latest = history[0];

  const lines: string[] = [];
  lines.push("======================================================");
  lines.push(" FREIRENET-SECUREGUARD — RELATÓRIO DE ESCANEAMENTO");
  lines.push("======================================================");
  lines.push("");
  if (snap) {
    lines.push(`Data do escaneamento : ${fmtDate(snap.date)}`);
    lines.push(`Origens analisadas   : ${snap.hostsScanned}`);
    lines.push(`Ameaças detectadas   : ${snap.threats.length}`);
  } else {
    lines.push("Nenhum escaneamento registrado. Execute uma varredura antes de gerar o relatório.");
  }
  if (latest) {
    lines.push(`Score de vulnerabilidade: ${latest.score}/100 (${latest.grade})`);
  }
  lines.push("");

  if (snap?.results?.length) {
    lines.push("------------------------------------------------------");
    lines.push(" RESUMO POR CATEGORIA");
    lines.push("------------------------------------------------------");
    for (const r of snap.results) {
      const flag = r.status === "safe" ? "OK" : r.status === "warning" ? "ATENÇÃO" : "CRÍTICO";
      lines.push(`[${flag}] ${r.category}: ${r.message}${r.count ? ` (${r.count})` : ""}`);
    }
    lines.push("");
  }

  if (snap?.threats?.length) {
    lines.push("------------------------------------------------------");
    lines.push(" DETECÇÕES POR HOST");
    lines.push("------------------------------------------------------");
    snap.threats.forEach((t, i) => {
      lines.push("");
      lines.push(`${i + 1}. Host: ${t.location}`);
      lines.push(`   Detecção: ${t.name}`);
      lines.push(`   Tipo: ${TYPE_LABEL[t.type]} | Severidade: ${SEVERITY_LABEL[t.severity]} | Status: ${t.status}`);
      const recs = recommendationsFor(t);
      if (recs.length) {
        lines.push("   Recomendações:");
        recs.forEach((r) => lines.push(`     - ${r}`));
      }
    });
    lines.push("");
  } else if (snap) {
    lines.push("Nenhuma ameaça detectada — todas as origens analisadas estão limpas.");
    lines.push("");
  }

  if (latest?.breakdown?.length) {
    lines.push("------------------------------------------------------");
    lines.push(" COMPOSIÇÃO DO SCORE DE VULNERABILIDADE");
    lines.push("------------------------------------------------------");
    latest.breakdown.forEach((b) => {
      lines.push(`  ${b.label.padEnd(28, " ")} ${String(b.score).padStart(3, " ")}/100`);
    });
    lines.push("");
  }

  if (history.length > 1) {
    lines.push("------------------------------------------------------");
    lines.push(" HISTÓRICO RECENTE");
    lines.push("------------------------------------------------------");
    history.slice(0, 10).forEach((h) => {
      lines.push(`  ${fmtDate(h.date)} — ${h.score}/100 (${h.grade})`);
    });
    lines.push("");
  }

  lines.push("------------------------------------------------------");
  lines.push(" Gerado por Freirenet-SecureGuard");
  lines.push(`  ${new Date().toLocaleString("pt-BR")}`);
  lines.push("------------------------------------------------------");
  return lines.join("\n");
}

// ---------- PDF report ----------
export function buildPdfReport(): jsPDF {
  const snap = getLastScan();
  const history = getScanHistory();
  const latest = history[0];

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const setColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    doc.setTextColor(r, g, b);
  };
  const setFill = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    doc.setFillColor(r, g, b);
  };

  // Header banner
  setFill("#0F172A");
  doc.rect(0, 0, pageW, 90, "F");
  setColor("#22D3EE");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Freirenet-SecureGuard", margin, 48);
  setColor("#F1F5F9");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Relatório de Escaneamento de Segurança", margin, 68);
  y = 120;

  // Meta box
  setColor("#0F172A");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Resumo Geral", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setColor("#334155");

  const meta = [
    ["Data do escaneamento", snap ? fmtDate(snap.date) : "—"],
    ["Origens analisadas", snap ? String(snap.hostsScanned) : "—"],
    ["Ameaças detectadas", snap ? String(snap.threats.length) : "—"],
    ["Score de vulnerabilidade", latest ? `${latest.score}/100 (${latest.grade})` : "—"],
  ];
  meta.forEach(([k, v]) => {
    ensureSpace(16);
    doc.text(`${k}:`, margin, y);
    doc.text(v, margin + 180, y);
    y += 16;
  });
  y += 8;

  // Category summary
  if (snap?.results?.length) {
    ensureSpace(30);
    setColor("#0F172A");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Resumo por Categoria", margin, y);
    y += 18;
    doc.setFontSize(11);
    snap.results.forEach((r) => {
      ensureSpace(18);
      const tag = r.status === "safe" ? "OK" : r.status === "warning" ? "!" : "X";
      const tagColor = r.status === "safe" ? "#16A34A" : r.status === "warning" ? "#D97706" : "#DC2626";
      setFill(tagColor);
      doc.roundedRect(margin, y - 11, 18, 14, 2, 2, "F");
      setColor("#FFFFFF");
      doc.setFont("helvetica", "bold");
      doc.text(tag, margin + 9, y - 1, { align: "center" });
      setColor("#0F172A");
      doc.setFont("helvetica", "bold");
      doc.text(r.category, margin + 26, y);
      doc.setFont("helvetica", "normal");
      setColor("#475569");
      const msg = `${r.message}${r.count ? `  (${r.count})` : ""}`;
      const wrapped = doc.splitTextToSize(msg, pageW - margin * 2 - 180) as string[];
      doc.text(wrapped, margin + 180, y);
      y += Math.max(16, wrapped.length * 14);
    });
    y += 6;
  }

  // Threats per host
  ensureSpace(30);
  setColor("#0F172A");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Detecções por Host", margin, y);
  y += 18;

  if (!snap?.threats?.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    setColor("#16A34A");
    doc.text("Nenhuma ameaça detectada — todas as origens analisadas estão limpas.", margin, y);
    y += 20;
  } else {
    snap.threats.forEach((t, i) => {
      const recs = recommendationsFor(t);
      const blockH = 60 + recs.length * 14;
      ensureSpace(blockH);

      const sevColor =
        t.severity === "high" ? "#DC2626" :
        t.severity === "medium" ? "#D97706" : "#16A34A";

      // Card background
      setFill("#F8FAFC");
      doc.roundedRect(margin, y - 12, pageW - margin * 2, blockH, 6, 6, "F");
      setFill(sevColor);
      doc.rect(margin, y - 12, 4, blockH, "F");

      setColor("#0F172A");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`${i + 1}. ${t.location}`, margin + 12, y + 2);

      // Severity badge
      const badgeText = SEVERITY_LABEL[t.severity].toUpperCase();
      doc.setFontSize(9);
      const badgeW = doc.getTextWidth(badgeText) + 14;
      setFill(sevColor);
      doc.roundedRect(pageW - margin - badgeW, y - 8, badgeW, 14, 3, 3, "F");
      setColor("#FFFFFF");
      doc.text(badgeText, pageW - margin - badgeW / 2, y + 2, { align: "center" });

      setColor("#334155");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Detecção: ${t.name}`, margin + 12, y + 18);
      doc.text(`Tipo: ${TYPE_LABEL[t.type]}   •   Status: ${t.status}`, margin + 12, y + 32);

      if (recs.length) {
        setColor("#0F172A");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Recomendações:", margin + 12, y + 48);
        doc.setFont("helvetica", "normal");
        setColor("#475569");
        recs.forEach((r, idx) => {
          const wrapped = doc.splitTextToSize(`• ${r}`, pageW - margin * 2 - 24) as string[];
          doc.text(wrapped, margin + 20, y + 62 + idx * 14);
        });
      }
      y += blockH + 8;
    });
  }

  // Breakdown of score
  if (latest?.breakdown?.length) {
    ensureSpace(30);
    setColor("#0F172A");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Composição do Score", margin, y);
    y += 18;
    doc.setFontSize(10);
    latest.breakdown.forEach((b) => {
      ensureSpace(18);
      doc.setFont("helvetica", "normal");
      setColor("#334155");
      doc.text(b.label, margin, y);
      // bar
      const barX = margin + 200;
      const barW = pageW - margin - barX - 50;
      setFill("#E2E8F0");
      doc.roundedRect(barX, y - 8, barW, 10, 3, 3, "F");
      const pct = Math.max(0, Math.min(100, b.score)) / 100;
      setFill(b.score >= 70 ? "#16A34A" : b.score >= 40 ? "#D97706" : "#DC2626");
      doc.roundedRect(barX, y - 8, barW * pct, 10, 3, 3, "F");
      setColor("#0F172A");
      doc.text(`${b.score}/100`, pageW - margin, y, { align: "right" });
      y += 16;
    });
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    setColor("#94A3B8");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Freirenet-SecureGuard — ${new Date().toLocaleString("pt-BR")}`, margin, pageH - 24);
    doc.text(`Página ${p} de ${pages}`, pageW - margin, pageH - 24, { align: "right" });
  }

  return doc;
}

export function downloadTextReport(filename = "freirenet-scan-report.txt") {
  const text = buildTextReport();
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadPdfReport(filename = "freirenet-scan-report.pdf") {
  const doc = buildPdfReport();
  doc.save(filename);
}
