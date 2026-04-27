import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { MODULES, type ModuleKey } from "@/lib/modules";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Crown, Check, Lock, Unlock } from "lucide-react";
import { fmtBRL } from "@/lib/format";
import { toast } from "sonner";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_one_time: number | null;
  modules: string[];
  active: boolean;
};

type Subscription = {
  id: string;
  company_id: string;
  plan_id: string;
  active: boolean;
  ends_at: string | null;
};

export function SubscriptionSection() {
  const { user } = useAuth();
  const { activeCompany, companies } = useCompany();
  const { isSuperAdmin, reload: reloadAccess } = usePlanAccess();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [editingCompanyId, setEditingCompanyId] = useState<string>("");

  const targetCompanyId = isSuperAdmin ? (editingCompanyId || activeCompany?.id || "") : activeCompany?.id || "";

  const load = useCallback(async () => {
    const { data: pData } = await supabase.from("plans").select("*").order("price_monthly");
    setPlans((pData ?? []) as any);

    if (targetCompanyId) {
      const { data: sData } = await supabase
        .from("company_subscriptions")
        .select("id, company_id, plan_id, active, ends_at")
        .eq("company_id", targetCompanyId);
      setSubs((sData ?? []) as any);

      const { data: oData } = await supabase
        .from("company_module_overrides")
        .select("module_key, enabled")
        .eq("company_id", targetCompanyId);
      const map: Record<string, boolean> = {};
      (oData ?? []).forEach((o: any) => { map[o.module_key] = o.enabled; });
      setOverrides(map);
    } else {
      setSubs([]);
      setOverrides({});
    }
  }, [targetCompanyId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (isSuperAdmin && !editingCompanyId && activeCompany?.id) setEditingCompanyId(activeCompany.id);
  }, [isSuperAdmin, activeCompany?.id]);

  const isPlanActive = (planId: string) => subs.some(s => s.plan_id === planId && s.active);

  const togglePlan = async (planId: string, on: boolean) => {
    if (!isSuperAdmin || !targetCompanyId) return;
    if (on) {
      const { error } = await supabase
        .from("company_subscriptions")
        .upsert({ company_id: targetCompanyId, plan_id: planId, active: true, granted_by: user!.id }, { onConflict: "company_id,plan_id" });
      if (error) return toast.error(error.message);
      toast.success("Plano liberado");
    } else {
      const { error } = await supabase
        .from("company_subscriptions")
        .delete()
        .eq("company_id", targetCompanyId).eq("plan_id", planId);
      if (error) return toast.error(error.message);
      toast.success("Plano revogado");
    }
    await load();
    await reloadAccess();
  };

  const updatePlanPrice = async (planId: string, field: "price_monthly" | "price_one_time", value: number | null) => {
    if (!isSuperAdmin) return;
    const { error } = await supabase.from("plans").update({ [field]: value }).eq("id", planId);
    if (error) return toast.error(error.message);
    toast.success("Valor atualizado");
    await load();
  };

  const toggleOverride = async (moduleKey: ModuleKey, enabled: boolean) => {
    if (!isSuperAdmin || !targetCompanyId) return;
    const { error } = await supabase
      .from("company_module_overrides")
      .upsert({ company_id: targetCompanyId, module_key: moduleKey, enabled }, { onConflict: "company_id,module_key" });
    if (error) return toast.error(error.message);
    setOverrides({ ...overrides, [moduleKey]: enabled });
    await reloadAccess();
  };

  const removeOverride = async (moduleKey: ModuleKey) => {
    if (!isSuperAdmin || !targetCompanyId) return;
    await supabase.from("company_module_overrides").delete().eq("company_id", targetCompanyId).eq("module_key", moduleKey);
    const next = { ...overrides }; delete next[moduleKey]; setOverrides(next);
    await reloadAccess();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" /> Assinatura
            {isSuperAdmin && <Badge className="bg-gradient-gold text-primary-foreground ml-2">Modo Super Admin</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuperAdmin && (
            <div className="flex items-center gap-3 pb-3 border-b border-border/40">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Empresa-alvo</Label>
              <select
                className="bg-background border border-border rounded-md px-2 py-1 text-sm"
                value={targetCompanyId}
                onChange={e => setEditingCompanyId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {!targetCompanyId && (
            <p className="text-sm text-muted-foreground">Selecione uma empresa para ver/gerenciar assinaturas.</p>
          )}

          {targetCompanyId && (
            <div className="grid gap-3 md:grid-cols-2">
              {plans.map(p => {
                const active = isPlanActive(p.id);
                return (
                  <div key={p.id} className={`rounded-lg border p-4 transition ${active ? "border-primary/60 bg-primary/5" : "border-border/40 bg-card/40"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-display text-base flex items-center gap-2">
                          {p.name}
                          {active && <Check className="h-4 w-4 text-primary" />}
                        </div>
                        {p.description && <div className="text-xs text-muted-foreground mt-0.5">{p.description}</div>}
                      </div>
                      {isSuperAdmin && (
                        <Switch checked={active} onCheckedChange={v => togglePlan(p.id, v)} />
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      {isSuperAdmin ? (
                        <>
                          <div>
                            <Label className="text-[10px] uppercase">Mensal (R$)</Label>
                            <Input
                              type="number" step="0.01" className="h-8 w-28"
                              defaultValue={p.price_monthly}
                              onBlur={e => updatePlanPrice(p.id, "price_monthly", Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase">Avulso (R$)</Label>
                            <Input
                              type="number" step="0.01" className="h-8 w-28"
                              defaultValue={p.price_one_time ?? ""}
                              onBlur={e => updatePlanPrice(p.id, "price_one_time", e.target.value ? Number(e.target.value) : null)}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="text-sm">
                          <span className="font-semibold tabular-nums">{fmtBRL(p.price_monthly)}</span>
                          <span className="text-muted-foreground"> /mês</span>
                          {p.price_one_time != null && <span className="text-xs text-muted-foreground ml-2">ou {fmtBRL(p.price_one_time)} avulso</span>}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {p.modules.map(m => (
                        <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {isSuperAdmin && targetCompanyId && (
        <Card>
          <CardHeader><CardTitle className="text-base font-display">Controle de Módulos (override)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Use overrides para liberar/bloquear módulos manualmente, independente do plano. Útil para promoções ou bloqueios pontuais.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODULES.map(m => {
                const has = m.key in overrides;
                const enabled = overrides[m.key];
                return (
                  <div key={m.key} className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      {has ? (enabled ? <Unlock className="h-3.5 w-3.5 text-success" /> : <Lock className="h-3.5 w-3.5 text-destructive" />) : null}
                      <span>{m.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!enabled} onCheckedChange={v => toggleOverride(m.key, v)} />
                      {has && (
                        <Button size="sm" variant="ghost" onClick={() => removeOverride(m.key)} className="h-7 text-xs">limpar</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
