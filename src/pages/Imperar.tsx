import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { scope } from "@/lib/companyScope";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Imperar — Crescimento
 *
 * Coleta um snapshot financeiro da empresa ativa (transações, recebíveis,
 * pagáveis, orçamentos com margem, sócios) e pede à IA um diagnóstico
 * estratégico voltado a crescimento de faturamento, margem e clientes.
 */
export default function Imperar() {
  const { activeCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string>("");

  const buildSnapshot = async () => {
    const cid = activeCompany?.id ?? null;
    const since = new Date();
    since.setMonth(since.getMonth() - 6);
    const sinceStr = since.toISOString().slice(0, 10);

    const [tx, rec, pay, bud, par] = await Promise.all([
      scope(supabase.from("transactions").select("type, category, amount, date").gte("date", sinceStr), cid),
      scope(supabase.from("receivables").select("client, amount, cost, received, due_date"), cid),
      scope(supabase.from("payables").select("category, description, amount, paid, due_date"), cid),
      scope(supabase.from("budgets").select("client, product, sale_value, cost, net_profit, margin_percent, done, status"), cid),
      scope(supabase.from("partners").select("name, share_percent, pro_labore, active"), cid),
    ]);

    const txs = (tx.data ?? []) as any[];
    const receivables = (rec.data ?? []) as any[];
    const payables = (pay.data ?? []) as any[];
    const budgets = (bud.data ?? []) as any[];
    const partners = (par.data ?? []) as any[];

    const sum = (arr: any[], k: string) => arr.reduce((s, x) => s + Number(x[k] || 0), 0);
    const receitas = txs.filter(t => t.type === "receita");
    const despesas = txs.filter(t => t.type === "despesa");

    // Top categorias
    const groupSum = (arr: any[], key: string) => {
      const m = new Map<string, number>();
      arr.forEach(x => m.set(x[key] || "—", (m.get(x[key] || "—") || 0) + Number(x.amount || 0)));
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ categoria: k, total: v }));
    };

    // Margem por produto
    const margensProduto = budgets
      .filter(b => Number(b.sale_value) > 0)
      .map(b => ({
        produto: b.product,
        cliente: b.client,
        venda: Number(b.sale_value),
        custo: Number(b.cost),
        lucro: Number(b.net_profit),
        margem_percent: Number(b.margin_percent),
        status: b.status,
        finalizado: b.done,
      }))
      .sort((a, b) => a.margem_percent - b.margem_percent)
      .slice(0, 12);

    return {
      empresa: activeCompany?.name ?? "—",
      periodo_meses: 6,
      faturamento_periodo: sum(receitas, "amount"),
      despesa_periodo: sum(despesas, "amount"),
      saldo_periodo: sum(receitas, "amount") - sum(despesas, "amount"),
      receitas_top_categorias: groupSum(receitas, "category"),
      despesas_top_categorias: groupSum(despesas, "category"),
      contas_a_receber_em_aberto: receivables.filter(r => !r.received).length,
      total_a_receber: sum(receivables.filter(r => !r.received), "amount"),
      contas_a_pagar_em_aberto: payables.filter(p => !p.paid).length,
      total_a_pagar: sum(payables.filter(p => !p.paid), "amount"),
      orcamentos_total: budgets.length,
      orcamentos_finalizados: budgets.filter(b => b.done).length,
      ticket_medio_orcamentos: budgets.length ? sum(budgets, "sale_value") / budgets.length : 0,
      margens_por_produto: margensProduto,
      socios: partners.map(p => ({ nome: p.name, participacao: p.share_percent, pro_labore: p.pro_labore, ativo: p.active })),
    };
  };

  const generate = async () => {
    setLoading(true);
    setInsights("");
    try {
      const snapshot = await buildSnapshot();
      const { data, error } = await supabase.functions.invoke("imperar-insights", { body: { snapshot } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setInsights((data as any).markdown ?? "");
      toast.success("Diagnóstico gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar diagnóstico");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Imperar — Crescimento"
        subtitle="Inteligência para escalar faturamento, margem e clientes"
        actions={
          <Button onClick={generate} disabled={loading} className="gap-2 bg-gradient-gold text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analisando…" : insights ? "Regerar diagnóstico" : "Gerar diagnóstico"}
          </Button>
        }
      />

      {!insights && !loading && (
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardContent className="p-10 flex flex-col items-center text-center gap-4">
            <Rocket className="h-12 w-12 text-primary" />
            <h2 className="font-display text-2xl tracking-wide">Ative seu diagnóstico</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              A IA analisará seus últimos 6 meses (fluxo, DRE, custos, vendas) e devolverá:
              diagnóstico, gargalos, oportunidades, recomposição de margem e estratégias de marketing.
            </p>
          </CardContent>
        </Card>
      )}

      {insights && (
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardContent className="p-6 prose prose-invert max-w-none prose-headings:font-display prose-headings:text-foreground prose-strong:text-primary prose-li:my-1">
            <ReactMarkdown>{insights}</ReactMarkdown>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
