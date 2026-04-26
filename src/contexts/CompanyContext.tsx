import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Company = { id: string; name: string; cnpj: string | null; active: boolean };

type Ctx = {
  companies: Company[];
  activeCompany: Company | null;
  setActiveCompany: (c: Company | null) => Promise<void>;
  reloadCompanies: () => Promise<void>;
  loading: boolean;
};

const CompanyContext = createContext<Ctx | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadCompanies = useCallback(async () => {
    if (!user) { setCompanies([]); setActiveState(null); setLoading(false); return; }
    setLoading(true);
    const { data: comps } = await supabase.from("companies").select("*").order("created_at");
    const list = (comps || []) as Company[];
    setCompanies(list);
    const { data: settings } = await supabase.from("user_settings").select("active_company_id").eq("user_id", user.id).maybeSingle();
    const activeId = settings?.active_company_id;
    const active = list.find(c => c.id === activeId) || null;
    setActiveState(active);
    setLoading(false);
  }, [user]);

  useEffect(() => { reloadCompanies(); }, [reloadCompanies]);

  const setActiveCompany = async (c: Company | null) => {
    setActiveState(c);
    if (!user) return;
    const { data: existing } = await supabase.from("user_settings").select("id").eq("user_id", user.id).maybeSingle();
    if (existing) {
      await supabase.from("user_settings").update({ active_company_id: c?.id ?? null }).eq("user_id", user.id);
    } else {
      await supabase.from("user_settings").insert({ user_id: user.id, active_company_id: c?.id ?? null });
    }
  };

  return (
    <CompanyContext.Provider value={{ companies, activeCompany, setActiveCompany, reloadCompanies, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}

/**
 * Helper: applies the active company filter to a Supabase query if one is selected.
 * Backwards compatible — if no company is active, returns rows including legacy null company_id.
 */
export function applyCompanyFilter<T extends { eq: (col: string, v: any) => T; or?: any }>(
  query: T,
  activeCompanyId: string | null | undefined
): T {
  if (!activeCompanyId) return query;
  // @ts-ignore - .or is available on PostgrestFilterBuilder
  return query.or(`company_id.eq.${activeCompanyId},company_id.is.null`);
}
