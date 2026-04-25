import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { fmtBRL } from "@/lib/format";
import { exportToXlsx } from "@/lib/exporter";

type Tx = { date: string; type: string; amount: number; category: string | null; description: string };

export default function DRE() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!user) return;
    supabase.from("transactions").select("date,type,amount,category,description").then(({ data }) => {
      if (data) setTxs(data as any);
    });
  }, [user]);

  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const calcMonth = (m: number, type: "receita" | "despesa", category?: string) =>
    txs.filter(t => {
      const d = new Date(t.date + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() === m && t.type === type && (!category || t.category === category);
    }).reduce((s, t) => s + Number(t.amount), 0);

  const categorias = Array.from(new Set(txs.filter(t => t.type === "despesa").map(t => t.category || "Outros")));

  const totalRow = (label: string, fn: (m: number) => number, accent = false) => (
    <TableRow className={accent ? "bg-primary/5 font-semibold" : ""}>
      <TableCell className="font-medium">{label}</TableCell>
      {months.map((_, m) => (
        <TableCell key={m} className="text-right tabular-nums">{fn(m) ? fmtBRL(fn(m)) : "—"}</TableCell>
      ))}
      <TableCell className="text-right tabular-nums font-display text-primary-glow">
        {fmtBRL(months.reduce((s, _, m) => s + fn(m), 0))}
      </TableCell>
    </TableRow>
  );

  const exportar = () => {
    const rows: any[] = [];
    const push = (label: string, fn: (m: number) => number) => {
      const r: any = { Conta: label };
      months.forEach((mm, m) => (r[mm] = fn(m)));
      r.Total = months.reduce((s, _, m) => s + fn(m), 0);
      rows.push(r);
    };
    push("Receita Bruta", m => calcMonth(m, "receita"));
    categorias.forEach(c => push(`(-) ${c}`, m => calcMonth(m, "despesa", c)));
    push("Lucro Líquido", m => calcMonth(m, "receita") - calcMonth(m, "despesa"));
    exportToXlsx(rows, `imperio-dre-${year}`, "DRE");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="DRE Mensal"
        subtitle="Demonstração do Resultado do Exercício"
        actions={
          <>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={exportar} variant="outline" className="gap-2 border-primary/40 hover:bg-primary/10">
              <Download className="h-4 w-4" /> Exportar
            </Button>
          </>
        }
      />

      <Card className="p-0 bg-card/60 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-primary/30">
                <TableHead className="sticky left-0 bg-card z-10 min-w-[200px] text-primary">Conta</TableHead>
                {months.map(m => <TableHead key={m} className="text-right min-w-[100px]">{m}</TableHead>)}
                <TableHead className="text-right min-w-[120px] text-primary">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {totalRow("Receita Bruta", m => calcMonth(m, "receita"), true)}
              <TableRow><TableCell colSpan={14} className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground py-2">Despesas e Custos</TableCell></TableRow>
              {categorias.map(c => totalRow(`(-) ${c}`, m => calcMonth(m, "despesa", c)))}
              {totalRow("Total Despesas", m => calcMonth(m, "despesa"), true)}
              <TableRow className="bg-gradient-gold/10 border-t-2 border-primary/40">
                <TableCell className="font-display text-lg text-gold">= Lucro Líquido</TableCell>
                {months.map((_, m) => {
                  const v = calcMonth(m, "receita") - calcMonth(m, "despesa");
                  return <TableCell key={m} className={`text-right tabular-nums font-semibold ${v >= 0 ? "text-success" : "text-destructive"}`}>{v ? fmtBRL(v) : "—"}</TableCell>;
                })}
                <TableCell className="text-right font-display text-xl text-gold">
                  {fmtBRL(months.reduce((s, _, m) => s + calcMonth(m, "receita") - calcMonth(m, "despesa"), 0))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
