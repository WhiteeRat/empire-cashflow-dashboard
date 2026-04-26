import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtBRL, fmtDate } from "@/lib/format";

/**
 * Tipos públicos do PDF de Distribuição de Lucros.
 * Mantido enxuto para reuso em diferentes telas (Diretoria, Contabilidade).
 */
export type DistributionPartnerLine = {
  partner_name: string;
  share_percent: number;
  amount: number;
};

export type DistributionPdfData = {
  companyName?: string;
  companyCnpj?: string;
  periodLabel: string;
  periodStart: string; // ISO yyyy-mm-dd
  periodEnd: string;   // ISO yyyy-mm-dd
  revenue: number;
  expenses: number;
  taxes: number;
  costs: number;
  netProfit: number;
  totalDistributed: number;
  mode: "proporcional" | "manual";
  partners: DistributionPartnerLine[];
  notes?: string;
};

/**
 * Gera PDF formal de distribuição de lucros com cabeçalho da empresa,
 * resumo do apurado no período, rateio por sócio e campo de assinaturas.
 */
export function exportDistributionPdf(d: DistributionPdfData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(96, 165, 250);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(d.companyName || "IMPÉRIO", margin, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 220, 255);
  if (d.companyCnpj) doc.text(`CNPJ: ${d.companyCnpj}`, margin, 54);
  doc.text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, pageWidth - margin, 38, { align: "right" });

  y = 100;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Distribuição de Lucros", margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Período: ${d.periodLabel}  (${fmtDate(d.periodStart)} a ${fmtDate(d.periodEnd)})`, margin, y);
  y += 14;
  doc.text(`Modo de distribuição: ${d.mode === "proporcional" ? "Proporcional à participação" : "Manual"}`, margin, y);
  y += 18;

  // Resumo financeiro
  autoTable(doc, {
    startY: y,
    head: [["Apuração do período", "Valor"]],
    body: [
      ["Faturamento", fmtBRL(d.revenue)],
      ["(–) Despesas", fmtBRL(d.expenses)],
      ["(–) Impostos", fmtBRL(d.taxes)],
      ["(–) Custos", fmtBRL(d.costs)],
      ["Lucro Líquido", fmtBRL(d.netProfit)],
      ["Total distribuído", fmtBRL(d.totalDistributed)],
    ],
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: [96, 165, 250] },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  // Rateio por sócio
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Rateio por Sócio", margin, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [["Sócio", "Participação", "Valor a receber"]],
    body: d.partners.map(p => [p.partner_name, `${Number(p.share_percent).toFixed(2)}%`, fmtBRL(p.amount)]),
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], textColor: [96, 165, 250] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  if (d.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(`Observações: ${d.notes}`, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 11 + 10;
  }

  // Assinaturas
  if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = margin; }
  y += 30;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const colW = (pageWidth - margin * 2 - 30) / 2;
  d.partners.slice(0, 6).forEach((p, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = margin + col * (colW + 30);
    const yy = y + row * 70;
    doc.line(x, yy + 30, x + colW, yy + 30);
    doc.text(p.partner_name, x, yy + 44);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Assinatura", x, yy + 56);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
  });

  doc.save(`distribuicao-${d.periodLabel.replace(/\s+/g, "_")}.pdf`);
}
