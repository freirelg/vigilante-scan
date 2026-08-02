import jsPDF from "jspdf";
import { ScanRecord } from "@/lib/scanHistory";
import { collectRealSignals, RealSignals } from "@/lib/realSignals";
import { supabase } from "@/integrations/supabase/client";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function yesNo(v: boolean | null | undefined) {
  if (v === null || v === undefined) return "Não verificado";
  return v ? "Sim" : "Não";
}

function buildAiSummary(records: ScanRecord[], s: RealSignals | null) {
  const lines: string[] = [];
  lines.push("Últimas análises (score/100):");
  records.forEach((r) =>
    lines.push(`- ${fmt(r.date)}: ${r.score} (${r.grade}) | ${r.breakdown.map((b) => `${b.label}=${b.score}`).join(", ")}`)
  );
  if (s) {
    lines.push("");
    lines.push("Evidências medidas no navegador:");
    lines.push(
      `HTTPS=${s.https}, contexto seguro=${s.secureContext}, HSTS=${s.hsts}, CSP=${s.csp}, X-Frame-Options=${s.xfo}, X-Content-Type-Options=${s.xcto}, Referrer-Policy=${s.referrerPolicy}, Permissions-Policy=${s.permPolicy}`
    );
    lines.push(
      `Cookies habilitados=${s.cookiesEnabled}, cookies de terceiros=${s.thirdPartyCookies}, DNT=${s.doNotTrack}, isolamento entre origens=${s.crossOriginIsolated}`
    );
    lines.push(
      `Armazenamento usado=${s.storageUsagePct}%, persistente=${s.persistentStorage}, online=${s.online}`
    );
    lines.push(
      `Permissões concedidas=${s.permissionsGranted}/${s.permissionsTotal}: ${s.permissions
        .filter((p) => p.state !== "unsupported")
        .map((p) => `${p.name}:${p.state}`)
        .join(", ")}`
    );
  }
  return lines.join("\n").slice(0, 8000);
}

async function getAiRecommendations(summary: string): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke("security-recommendations", {
      body: { summary },
    });
    if (error) return null;
    const recs = (data as { recommendations?: string[] })?.recommendations;
    return Array.isArray(recs) && recs.length > 0 ? recs : null;
  } catch {
    return null;
  }
}


export async function generateScanReport(history: ScanRecord[]) {
  const records = history.slice(0, 5);
  let signals: RealSignals | null = null;
  try {
    signals = await collectRealSignals();
  } catch {
    signals = null;
  }

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = 0;

  const ensure = (needed: number) => {
    if (y + needed > H - 60) {
      footer();
      doc.addPage();
      y = M;
    }
  };

  const footer = () => {
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      "Freirenet-SecureGuard — Inteligência em Segurança Digital na Palma da Sua Mão",
      M,
      H - 28
    );
  };

  const heading = (text: string) => {
    ensure(40);
    doc.setFontSize(13);
    doc.setTextColor(20, 40, 70);
    doc.setFont("helvetica", "bold");
    doc.text(text, M, y);
    y += 8;
    doc.setDrawColor(215);
    doc.line(M, y, W - M, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    doc.setFontSize(10);
  };

  const row = (label: string, value: string) => {
    ensure(16);
    doc.setTextColor(90);
    doc.text(label, M, y);
    doc.setTextColor(20);
    doc.text(String(value), M + 240, y);
    y += 15;
  };

  // Cover header
  doc.setFillColor(11, 22, 40);
  doc.rect(0, 0, W, 96, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("Relatório de Segurança", M, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(180, 205, 235);
  doc.text("Freirenet-SecureGuard · Análise do dispositivo", M, 66);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, M, 82);
  y = 130;

  // Summary
  heading("Resumo das últimas análises");
  if (records.length === 0) {
    row("Situação", "Nenhuma análise registrada.");
  } else {
    const avg = Math.round(
      records.reduce((s, r) => s + r.score, 0) / records.length
    );
    row("Análises no relatório", `${records.length}`);
    row("Score mais recente", `${records[0].score} (${records[0].grade})`);
    row("Média", `${avg}`);
    row("Melhor score", `${Math.max(...records.map((r) => r.score))}`);
    row("Pior score", `${Math.min(...records.map((r) => r.score))}`);
    y += 8;

    heading("Histórico detalhado");
    records.forEach((r, i) => {
      ensure(30 + r.breakdown.length * 14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20);
      doc.text(`${i + 1}. ${fmt(r.date)} — ${r.score}/100 (${r.grade})`, M, y);
      doc.setFont("helvetica", "normal");
      y += 15;
      r.breakdown.forEach((b) => {
        ensure(14);
        doc.setTextColor(90);
        doc.text(`• ${b.label}`, M + 14, y);
        doc.setTextColor(20);
        doc.text(`${b.score}`, M + 240, y);
        y += 14;
      });
      y += 6;
    });
  }

  // Evidence
  heading("Evidências medidas no navegador");
  if (!signals) {
    row("Coleta", "Não foi possível coletar os sinais do navegador.");
  } else {
    row("Conexão HTTPS", yesNo(signals.https));
    row("Contexto seguro", yesNo(signals.secureContext));
    row("HSTS (Strict-Transport-Security)", yesNo(signals.hsts));
    row("Content-Security-Policy", yesNo(signals.csp));
    row("X-Frame-Options", yesNo(signals.xfo));
    row("X-Content-Type-Options", yesNo(signals.xcto));
    row("Referrer-Policy", yesNo(signals.referrerPolicy));
    row("Permissions-Policy", yesNo(signals.permPolicy));
    row("Cookies habilitados", yesNo(signals.cookiesEnabled));
    row("Cookies de terceiros", signals.thirdPartyCookies);
    row("Do Not Track ativo", yesNo(signals.doNotTrack));
    row("Isolamento entre origens", yesNo(signals.crossOriginIsolated));
    row("Armazenamento usado", `${signals.storageUsagePct}%`);
    row("Armazenamento persistente", yesNo(signals.persistentStorage));
    row("Dispositivo online", yesNo(signals.online));
    row(
      "Permissões concedidas",
      `${signals.permissionsGranted} de ${signals.permissionsTotal}`
    );

    y += 8;
    heading("Permissões do navegador");
    signals.permissions
      .filter((p) => p.state !== "unsupported")
      .forEach((p) => row(p.name, p.state));
  }

  y += 10;
  ensure(60);
  doc.setFontSize(8);
  doc.setTextColor(120);
  const note = doc.splitTextToSize(
    "Observação: as medições refletem a superfície de navegador/rede acessível a partir desta origem. " +
      "Cabeçalhos de segurança são verificados na própria origem do aplicativo, conforme as restrições de segurança do navegador.",
    W - M * 2
  );
  doc.text(note, M, y);

  footer();

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  doc.save(`freirenet-relatorio-${stamp}.pdf`);
}
