import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ScanRecord } from "@/lib/scanHistory";

/**
 * Generates a PDF report for a single scan analysis or scan history.
 */
export async function generatePDFReport(data: {
  type: "single" | "history";
  title: string;
  records: ScanRecord[];
  summary?: {
    avgScore: number;
    bestScore: number;
    totalScans: number;
  };
}) {
  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString("pt-BR");

  // Header
  doc.setFontSize(22);
  doc.setTextColor(59, 130, 246); // Primary blue
  doc.text("Freirenet-SecureGuard", 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Relatório de Segurança - Gerado em ${timestamp}`, 14, 28);
  
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 32, 196, 32);

  let currentY = 42;

  if (data.type === "single" && data.records.length > 0) {
    const record = data.records[0];
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Resumo da Análise Atual", 14, currentY);
    
    currentY += 10;
    doc.setFontSize(12);
    doc.text(`Score Final: ${record.score}/100`, 14, currentY);
    currentY += 7;
    doc.text(`Avaliação: ${record.grade}`, 14, currentY);
    currentY += 7;
    doc.text(`Data: ${new Date(record.date).toLocaleString("pt-BR")}`, 14, currentY);
    
    currentY += 15;
    doc.setFontSize(14);
    doc.text("Detalhamento por Categoria", 14, currentY);
    
    const tableData = record.breakdown.map(item => [
      item.label,
      `${item.score}/100`
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [["Categoria", "Pontuação"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });
    
  } else if (data.type === "history" && data.summary) {
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Estatísticas do Histórico", 14, currentY);
    
    currentY += 10;
    doc.setFontSize(12);
    doc.text(`Total de Scans: ${data.summary.totalScans}`, 14, currentY);
    currentY += 7;
    doc.text(`Média de Score: ${data.summary.avgScore}`, 14, currentY);
    currentY += 7;
    doc.text(`Melhor Score: ${data.summary.bestScore}`, 14, currentY);
    
    currentY += 15;
    doc.setFontSize(14);
    doc.text("Registros de Scans Anteriores", 14, currentY);
    
    const tableData = data.records.map(r => [
      new Date(r.date).toLocaleString("pt-BR"),
      r.score.toString(),
      r.grade
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [["Data/Hora", "Score", "Avaliação"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "Inteligência em Segurança Digital na Palma da Sua Mão",
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save/Download
  const filename = `freirenet-report-${new Date().getTime()}.pdf`;
  doc.save(filename);
}
