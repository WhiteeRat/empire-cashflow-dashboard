import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export type PdfRow = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // sempre positivo
  type: "receita" | "despesa";
  include: boolean;
};

const monthMap: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

function normalizeDate(raw: string): string | null {
  // dd/mm/aaaa
  let m = raw.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m[2]}-${m[1]}`;
  }
  // dd/mm
  m = raw.match(/^(\d{2})\/(\d{2})$/);
  if (m) {
    const y = new Date().getFullYear();
    return `${y}-${m[2]}-${m[1]}`;
  }
  // dd-mmm-aaaa (ex: 12-jan-2025)
  m = raw.match(/^(\d{2})[-/]([a-zç]{3})[-/](\d{2,4})$/i);
  if (m) {
    const mm = monthMap[m[2].toLowerCase().replace("ç", "c").slice(0, 3)];
    if (mm) {
      let y = m[3];
      if (y.length === 2) y = "20" + y;
      return `${y}-${mm}-${m[1]}`;
    }
  }
  return null;
}

function parseAmount(raw: string): { value: number; type: "receita" | "despesa" } | null {
  // Captura valores tipo: 1.234,56  /  -1.234,56  /  1234.56  /  R$ 1.234,56  /  1.234,56 D / 1.234,56 C
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const m = cleaned.match(/(-?\s*R?\$?\s*[\d.,]+)\s*(D|C|\+|-)?$/i);
  if (!m) return null;
  let numStr = m[1].replace(/[R$\s]/g, "");
  const negativeSign = numStr.startsWith("-");
  numStr = numStr.replace(/^-/, "");
  // Detectar formato BR (1.234,56) vs US (1,234.56)
  if (numStr.includes(",") && numStr.lastIndexOf(",") > numStr.lastIndexOf(".")) {
    numStr = numStr.replace(/\./g, "").replace(",", ".");
  } else {
    numStr = numStr.replace(/,/g, "");
  }
  const value = parseFloat(numStr);
  if (isNaN(value) || value === 0) return null;
  const flag = m[2]?.toUpperCase();
  let type: "receita" | "despesa" = "receita";
  if (negativeSign || flag === "D" || flag === "-") type = "despesa";
  if (flag === "C" || flag === "+") type = "receita";
  return { value: Math.abs(value), type };
}

export async function parsePdfStatement(file: File): Promise<PdfRow[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    // Agrupa itens por linha (Y aproximado)
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

  const result: PdfRow[] = [];
  const dateRe = /(\d{2}\/\d{2}\/\d{2,4}|\d{2}\/\d{2}|\d{2}[-/][a-zç]{3}[-/]\d{2,4})/i;

  for (const line of lines) {
    const dm = line.match(dateRe);
    if (!dm) continue;
    const date = normalizeDate(dm[1]);
    if (!date) continue;
    const rest = line.slice(dm.index! + dm[0].length).trim();
    if (!rest) continue;
    const parsed = parseAmount(rest);
    if (!parsed) continue;
    // Descrição = entre data e valor
    const valueIdx = rest.lastIndexOf(rest.match(/(-?\s*R?\$?\s*[\d.,]+)\s*(D|C|\+|-)?$/i)![0]);
    const description = rest.slice(0, valueIdx).trim().replace(/\s+/g, " ") || "Importado PDF";
    if (description.length < 2) continue;
    result.push({ date, description, amount: parsed.value, type: parsed.type, include: true });
  }

  return result;
}
