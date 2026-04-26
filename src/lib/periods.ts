/**
 * Helpers de períodos para apuração contábil/financeira.
 * Mensal, Trimestral, Semestral, Anual, Personalizado.
 */
export type PeriodType = "mensal" | "trimestral" | "semestral" | "anual" | "custom";

export type PeriodRange = {
  start: string; // YYYY-MM-DD
  end: string;
  label: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function buildPeriod(type: PeriodType, year: number, opts?: { month?: number; quarter?: number; semester?: number; customStart?: string; customEnd?: string }): PeriodRange {
  if (type === "anual") {
    return { start: `${year}-01-01`, end: `${year}-12-31`, label: `Anual ${year}` };
  }
  if (type === "semestral") {
    const sem = opts?.semester || 1;
    if (sem === 1) return { start: `${year}-01-01`, end: `${year}-06-30`, label: `1º Semestre ${year}` };
    return { start: `${year}-07-01`, end: `${year}-12-31`, label: `2º Semestre ${year}` };
  }
  if (type === "trimestral") {
    const q = opts?.quarter || 1;
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDay = new Date(year, endMonth, 0).getDate();
    return {
      start: `${year}-${pad(startMonth)}-01`,
      end: `${year}-${pad(endMonth)}-${pad(lastDay)}`,
      label: `Q${q} ${year}`,
    };
  }
  if (type === "mensal") {
    const m = opts?.month || new Date().getMonth() + 1;
    const lastDay = new Date(year, m, 0).getDate();
    return {
      start: `${year}-${pad(m)}-01`,
      end: `${year}-${pad(m)}-${pad(lastDay)}`,
      label: `${pad(m)}/${year}`,
    };
  }
  // custom
  const s = opts?.customStart || `${year}-01-01`;
  const e = opts?.customEnd || iso(new Date());
  return { start: s, end: e, label: `${s} → ${e}` };
}
