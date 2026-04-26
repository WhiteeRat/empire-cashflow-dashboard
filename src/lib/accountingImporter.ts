import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * Tipo do item de Informe de Rendimentos extraído.
 * Usado tanto para parser local quanto para resultado da IA.
 */
export type IncomeStatementItem = {
  source_name: string;
  source_cnpj?: string;
  taxable_income: number;
  exempt_income: number;
  ir_withheld: number;
  contributions: number;
  classification?: "tributavel" | "isento" | "exclusivo_fonte" | "indefinido";
  warnings?: string[];
};

const num = (v: any): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

/** Heurística: identifica colunas comuns por similaridade de nome. */
const pick = (row: Record<string, any>, candidates: string[]): any => {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const k = keys.find(k => k.toLowerCase().replace(/\s+/g, "").includes(cand));
    if (k != null) return row[k];
  }
  return undefined;
};

/** Parser local de CSV/XLSX — sem custo de IA. */
export async function parseSpreadsheet(file: File): Promise<IncomeStatementItem[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

  return rows
    .map((r): IncomeStatementItem | null => {
      const source = pick(r, ["fonte", "pagador", "empresa", "source", "razaosocial"]);
      if (!source) return null;
      return {
        source_name: String(source).trim(),
        source_cnpj: pick(r, ["cnpj"]) ? String(pick(r, ["cnpj"])).replace(/\D/g, "") : undefined,
        taxable_income: num(pick(r, ["tributavel", "tributável", "rendimentostributaveis"])),
        exempt_income: num(pick(r, ["isento", "isentos"])),
        ir_withheld: num(pick(r, ["irretido", "ir", "impostoretido"])),
        contributions: num(pick(r, ["previdencia", "previdência", "contribuicao", "inss"])),
        classification: "indefinido",
      };
    })
    .filter((x): x is IncomeStatementItem => x !== null);
}

/** Extrai texto bruto de um PDF para enviar à IA. */
export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return text;
}

/** Chama edge function de IA para extrair itens estruturados a partir de texto. */
export async function parseIncomeStatementWithAI(text: string, baseYear: number): Promise<IncomeStatementItem[]> {
  const { data, error } = await supabase.functions.invoke("parse-income-statement", {
    body: { text, baseYear },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return ((data as any)?.items || []) as IncomeStatementItem[];
}

/** Detecta inconsistências básicas — usado como camada local de QA. */
export function detectIssues(item: IncomeStatementItem): string[] {
  const issues: string[] = [];
  if (item.taxable_income < 0) issues.push("Valor tributável negativo");
  if (item.ir_withheld > item.taxable_income * 0.275) issues.push("IR retido excede 27,5% do tributável");
  if (!item.source_name || item.source_name.length < 3) issues.push("Fonte pagadora ausente ou inválida");
  if (item.taxable_income === 0 && item.exempt_income === 0) issues.push("Sem valores informados");
  return issues;
}
