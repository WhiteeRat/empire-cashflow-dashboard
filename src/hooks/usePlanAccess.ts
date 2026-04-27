import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import type { ModuleKey } from "@/lib/modules";

/**
 * usePlanAccess
 *
 * Calcula, para a empresa ativa do usuário, quais módulos estão liberados.
 *
 * Regras:
 *  - super_admin: acesso TOTAL a todos os módulos, em qualquer empresa.
 *  - Sem empresa ativa ("Todas as empresas"/legado): permite navegar (não trava o app),
 *    mas o gating real ocorre quando uma empresa é selecionada.
 *  - Com empresa ativa: união dos módulos de todos os planos ativos +
 *    overrides manuais (ligar/desligar) registrados em company_module_overrides.
 */
export function usePlanAccess() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [allowed, setAllowed] = useState<Set<ModuleKey>>(new Set());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setAllowed(new Set()); setLoading(false); return; }
    setLoading(true);

    // 1) checa super_admin
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();
    const superAdmin = !!roleRow;
    setIsSuperAdmin(superAdmin);

    if (superAdmin) {
      // libera tudo
      setAllowed(new Set([
        "dashboard","dre","fluxo","orcamentos","produtividade",
        "metricas","equipe","contabilidade","diretoria","imperar",
      ]));
      setLoading(false);
      return;
    }

    // 2) sem empresa ativa: não trava nenhuma aba (modo legado)
    if (!activeCompany) {
      setAllowed(new Set([
        "dashboard","dre","fluxo","orcamentos","produtividade",
        "metricas","equipe","contabilidade","diretoria","imperar",
      ]));
      setLoading(false);
      return;
    }

    // 3) carrega assinaturas + planos + overrides da empresa
    const [{ data: subs }, { data: overrides }] = await Promise.all([
      supabase
        .from("company_subscriptions")
        .select("plan_id, active, ends_at, plans(modules)")
        .eq("company_id", activeCompany.id)
        .eq("active", true),
      supabase
        .from("company_module_overrides")
        .select("module_key, enabled")
        .eq("company_id", activeCompany.id),
    ]);

    const set = new Set<ModuleKey>();
    const now = Date.now();
    (subs ?? []).forEach((s: any) => {
      if (s.ends_at && new Date(s.ends_at).getTime() < now) return;
      const mods = (s.plans?.modules ?? []) as ModuleKey[];
      mods.forEach((m) => set.add(m));
    });
    (overrides ?? []).forEach((o: any) => {
      if (o.enabled) set.add(o.module_key as ModuleKey);
      else set.delete(o.module_key as ModuleKey);
    });

    setAllowed(set);
    setLoading(false);
  }, [user, activeCompany]);

  useEffect(() => { reload(); }, [reload]);

  const has = useCallback((key: ModuleKey) => allowed.has(key), [allowed]);

  return { isSuperAdmin, allowed, has, loading, reload };
}
