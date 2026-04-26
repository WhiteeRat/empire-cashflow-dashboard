import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtBRL, fmtDate } from "@/lib/format";

export type BudgetPdfData = {
  companyName?: string;
  companyCnpj?: string;
  client: string;
  clientType?: string;
  city?: string;
  product: string;
  startDate?: string;
  endDate?: string;
  costs: { description: string; amount: number }[];
  costTotal: number;
  saleValue: number;
  marginPercent: number;
  signalValue: number;
  commissionName?: string;
  commissionPercent?: number;
  commissionValue?: number;
  netProfit: number;
  showCommission?: boolean;
};

export function exportBudgetPdf(d: BudgetPdfData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Header bar
  doc.setFillColor(15, 23, 42); // dark slate
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(96, 165, 250);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
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
  doc.text("ORÇAMENTO", margin, y);
  y += 22;

  // Client block
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${d.client}${d.clientType ? ` (${d.clientType})` : ""}`, margin + 60, y);
  y += 16;
  if (d.city) {
    doc.setFont("helvetica", "bold"); doc.text("CIDADE", margin, y);
    doc.setFont("helvetica", "normal"); doc.text(d.city, margin + 60, y); y += 16;
  }
  doc.setFont("helvetica", "bold"); doc.text("PRODUTO", margin, y);
  doc.setFont("helvetica", "normal"); doc.text(d.product, margin + 60, y); y += 16;
  if (d.startDate || d.endDate) {
    doc.setFont("helvetica", "bold"); doc.text("PRAZO", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${d.startDate ? fmtDate(d.startDate) : "—"} a ${d.endDate ? fmtDate(d.endDate) : "—"}`, margin + 60, y);
    y += 16;
  }
  y += 10;

  // Costs table
  if (d.costs.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Descrição", "Valor"]],
      body: d.costs.map(c => [c.description, fmtBRL(c.amount)]),
      theme: "striped",
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right", cellWidth: 120 } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Totals box
  const boxX = pageWidth - margin - 250;
  const boxW = 250;
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.8);
  let bY = y;
  const line = (label: string, value: string, bold = false, color?: [number, number, number]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(10);
    if (color) doc.setTextColor(...color); else doc.setTextColor(15, 23, 42);
    doc.text(label, boxX + 10, bY + 14);
    doc.text(value, boxX + boxW - 10, bY + 14, { align: "right" });
    bY += 18;
  };

  doc.setFillColor(241, 245, 249);
  const lines = 3 + (d.signalValue ? 1 : 0) + (d.showCommission && d.commissionValue ? 1 : 0) + 1;
  doc.rect(boxX, bY, boxW, lines * 18 + 8, "FD");
  bY += 4;
  line("Custo total", fmtBRL(d.costTotal));
  line("Margem", `${d.marginPercent.toFixed(1)}%`);
  if (d.showCommission && d.commissionValue) {
    line(`Comissão (${(d.commissionPercent || 0).toFixed(1)}%)`, fmtBRL(d.commissionValue), false, [217, 119, 6]);
  }
  if (d.signalValue) line("Sinal", fmtBRL(d.signalValue), false, [100, 116, 139]);
  line("Lucro líquido", fmtBRL(d.netProfit), true, [22, 163, 74]);

  // Highlight final value
  bY += 14;
  doc.setFillColor(59, 130, 246);
  doc.rect(boxX, bY, boxW, 36, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("VALOR TOTAL", boxX + 10, bY + 22);
  doc.setFontSize(16);
  doc.text(fmtBRL(d.saleValue), boxX + boxW - 10, bY + 24, { align: "right" });

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Documento gerado pelo sistema IMPÉRIO — Gestão Soberana", pageWidth / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });

  const safe = d.client.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  doc.save(`orcamento_${safe}.pdf`);
}
