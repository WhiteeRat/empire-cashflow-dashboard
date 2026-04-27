import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtBRL } from "@/lib/format";

export type SaasBudgetData = {
  companyName: string;
  companyCnpj: string | null;
  /** Apenas planos ativos */
  plans: { name: string; modules: string[]; price_monthly: number; price_one_time: number | null }[];
  /** Apenas módulos efetivamente liberados (planos + overrides) */
  enabledModules: { key: string; title: string }[];
};

/**
 * Gera o "Orçamento Geral" do SaaS — sumariza assinatura ativa, módulos liberados
 * e valor total mensal/avulso para a empresa indicada.
 */
export function exportSaasBudget(d: SaasBudgetData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ORÇAMENTO GERAL — SaaS Império", pageWidth / 2, 50, { align: "center" });
  doc.setDrawColor(180);
  doc.line(marginX, 60, pageWidth - marginX, 60);

  // Cadastro da empresa
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Cadastro da Empresa", marginX, 85);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Razão Social: ${d.companyName}`, marginX, 105);
  doc.text(`CNPJ: ${d.companyCnpj ?? "—"}`, marginX, 120);
  doc.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, marginX, 135);

  // Tabela de planos ativos
  autoTable(doc, {
    startY: 160,
    head: [["Plano contratado", "Mensalidade", "Avulso"]],
    body: d.plans.length
      ? d.plans.map(p => [p.name, fmtBRL(p.price_monthly), p.price_one_time != null ? fmtBRL(p.price_one_time) : "—"])
      : [["Nenhum plano ativo", "—", "—"]],
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    margin: { left: marginX, right: marginX },
  });

  const afterPlansY = (doc as any).lastAutoTable.finalY + 20;

  // Tabela de módulos liberados
  autoTable(doc, {
    startY: afterPlansY,
    head: [["Módulo / Aba liberada"]],
    body: d.enabledModules.length
      ? d.enabledModules.map(m => [m.title])
      : [["Nenhum módulo liberado"]],
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    margin: { left: marginX, right: marginX },
  });

  const afterModsY = (doc as any).lastAutoTable.finalY + 30;

  const totalMensal = d.plans.reduce((s, p) => s + (p.price_monthly || 0), 0);
  const totalAvulso = d.plans.reduce((s, p) => s + (p.price_one_time || 0), 0);

  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Resumo Financeiro", marginX, afterModsY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(`Total mensal: ${fmtBRL(totalMensal)}`, marginX, afterModsY + 20);
  if (totalAvulso > 0) doc.text(`Total avulso (opcional): ${fmtBRL(totalAvulso)}`, marginX, afterModsY + 38);

  // Rodapé
  doc.setFontSize(8); doc.setTextColor(120);
  doc.text(
    "Este orçamento reflete apenas os módulos atualmente ativos para esta empresa.",
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 30,
    { align: "center" }
  );

  doc.save(`orcamento-saas-${d.companyName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
