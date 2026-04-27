import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportSaasBudget } from "@/lib/saasBudgetPdf";
import { MODULES, type ModuleKey } from "@/lib/modules";
import { toast } from "sonner";

export function SaasBudgetExportSection() {
  const { activeCompany } = useCompany();
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!activeCompany) return toast.error("Selecione uma empresa ativa");
    setLoading(true);
    try {
      const [{ data: subs }, { data: overrides }] = await Promise.all([
        supabase
          .from("company_subscriptions")
          .select("plan_id, active, ends_at, plans(name, modules, price_monthly, price_one_time)")
          .eq("company_id", activeCompany.id)
          .eq("active", true),
        supabase
          .from("company_module_overrides")
          .select("module_key, enabled")
          .eq("company_id", activeCompany.id),
      ]);

      const now = Date.now();
      const activePlans = (subs ?? [])
        .filter((s: any) => !s.ends_at || new Date(s.ends_at).getTime() >= now)
        .map((s: any) => s.plans)
        .filter(Boolean);

      const enabled = new Set<ModuleKey>();
      activePlans.forEach((p: any) => (p.modules ?? []).forEach((m: any) => enabled.add(m)));
      (overrides ?? []).forEach((o: any) => {
        if (o.enabled) enabled.add(o.module_key);
        else enabled.delete(o.module_key);
      });

      exportSaasBudget({
        companyName: activeCompany.name,
        companyCnpj: activeCompany.cnpj,
        plans: activePlans.map((p: any) => ({
          name: p.name, modules: p.modules ?? [],
          price_monthly: Number(p.price_monthly ?? 0),
          price_one_time: p.price_one_time != null ? Number(p.price_one_time) : null,
        })),
        enabledModules: MODULES.filter(m => enabled.has(m.key)).map(m => ({ key: m.key, title: m.title })),
      });
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-display">Exportar Orçamento Geral</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Gera um PDF resumindo módulos ativos, planos contratados e valor total mensal/avulso da empresa selecionada.
        </p>
        <Button onClick={generate} disabled={loading || !activeCompany} className="gap-2 bg-gradient-gold text-primary-foreground">
          <FileDown className="h-4 w-4" /> {loading ? "Gerando…" : "Exportar Orçamento (PDF)"}
        </Button>
      </CardContent>
    </Card>
  );
}
