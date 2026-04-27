import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export type PdfRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // sempre positivo
  type: "receita" | "despesa";
  include: boolean;
};

/** Extrai todo o texto bruto do PDF, agrupando por linha. */
async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const it of tc.items as any[]) {
      const y = Math.round(it.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: it.transform[4], str: it.str });
    }
    const sortedY = Array.from(rows.keys()).sort((a, b) => b - a);
    for (const y of sortedY) {
      const parts = rows.get(y)!.sort((a, b) => a.x - b.x).map(p => p.str).join(" ");
      const clean = parts.replace(/\s+/g, " ").trim();
      if (clean) lines.push(clean);
    }
  }
  return lines.join("\n");
}

/**
 * Faz a leitura inteligente do extrato bancário usando IA (Lovable AI Gateway).
 * Extrai texto do PDF no client e envia à edge function `parse-bank-statement`.
 */
export async function parsePdfStatement(file: File): Promise<PdfRow[]> {
  const text = await extractPdfText(file);
  if (!text || text.length < 20) throw new Error("PDF sem texto extraível (talvez seja scaneado)");

  const { data, error } = await supabase.functions.invoke("parse-bank-statement", {
    body: { text },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);

  const rows: any[] = (data as any)?.rows || [];
  return rows
    .filter(r => r && r.date && r.amount > 0 && (r.type === "receita" || r.type === "despesa"))
    .map(r => ({
      date: String(r.date),
      description: String(r.description || "Importado PDF"),
      amount: Math.abs(Number(r.amount)),
      type: r.type,
      include: true,
    }));
}
