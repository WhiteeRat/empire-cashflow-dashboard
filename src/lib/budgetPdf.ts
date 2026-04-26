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
  /** Linhas de custo (descrição visível ao cliente). */
  costs: { description: string; amount: number }[];
  /** Valor final a ser pago pelo cliente. */
  saleValue: number;
  signalValue?: number;
  paymentMethod?: string;
  discountCash?: number;
};

/**
 * PDF voltado ao CLIENTE: mostra apenas os custos descritos pelo usuário,
 * o valor final, sinal (se houver), forma de pagamento e desconto à vista.
 * Não inclui margem, comissão ou lucro líquido (dados internos).
 */
export function exportBudgetPdf(d: BudgetPdfData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Header bar
  doc.setFillColor(15, 23, 42);
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

  // Costs / itens table (descrições visíveis ao cliente)
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

  // Pagamento
  const hasSignal = (d.signalValue || 0) > 0;
  const hasDiscount = (d.discountCash || 0) > 0;
  const valueAfterDiscount = d.saleValue - (d.discountCash || 0);

  const boxX = pageWidth - margin - 260;
  const boxW = 260;
  let bY = y;

  if (d.paymentMethod || hasSignal || hasDiscount) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("CONDIÇÕES DE PAGAMENTO", margin, bY + 12);
    doc.setFont("helvetica", "normal");
    let cY = bY + 28;
    // Largura útil para o texto de pagamento (deixa espaço lateral antes do box do total)
    const payMaxWidth = boxX - margin - 20;
    if (d.paymentMethod) {
      const label = "Forma de pagamento: ";
      const labelWidth = doc.getTextWidth(label);
      // Quebra a string longa em múltiplas linhas respeitando a largura disponível
      const lines: string[] = doc.splitTextToSize(d.paymentMethod, payMaxWidth - labelWidth) as string[];
      doc.text(label + (lines[0] ?? ""), margin, cY); cY += 14;
      for (let i = 1; i < lines.length; i++) {
        doc.text(lines[i], margin + labelWidth, cY); cY += 14;
      }
    }
    if (hasSignal) {
      doc.text(`Sinal: ${fmtBRL(d.signalValue!)}`, margin, cY); cY += 14;
    }
    if (hasDiscount) {
      doc.setTextColor(22, 163, 74);
      doc.text(`Desconto à vista: ${fmtBRL(d.discountCash!)}`, margin, cY); cY += 14;
      doc.setTextColor(15, 23, 42);
    }
    bY = Math.max(bY, cY) + 6;
  }

  // Highlight final value
  doc.setFillColor(59, 130, 246);
  doc.rect(boxX, bY, boxW, 50, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("VALOR TOTAL", boxX + 12, bY + 22);
  doc.setFontSize(18);
  doc.text(fmtBRL(d.saleValue), boxX + boxW - 12, bY + 24, { align: "right" });

  if (hasDiscount) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`À vista: ${fmtBRL(valueAfterDiscount)}`, boxX + boxW - 12, bY + 42, { align: "right" });
  }

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Documento gerado pelo sistema IMPÉRIO — Gestão Soberana", pageWidth / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });

  const safe = d.client.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  doc.save(`orcamento_${safe}.pdf`);
}
