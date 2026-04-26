-- 1) Companies
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cnpj TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own companies" ON public.companies FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER companies_set_user_id BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Budget costs (dynamic line items)
CREATE TABLE public.budget_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'outros',
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.budget_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budget_costs" ON public.budget_costs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER budget_costs_set_user_id BEFORE INSERT ON public.budget_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE INDEX idx_budget_costs_budget ON public.budget_costs(budget_id);

-- 3) User settings (popup config + active company)
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  active_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  show_pending_popup BOOLEAN NOT NULL DEFAULT true,
  popup_show_budgets BOOLEAN NOT NULL DEFAULT true,
  popup_show_payables BOOLEAN NOT NULL DEFAULT true,
  popup_show_receivables BOOLEAN NOT NULL DEFAULT true,
  popup_show_agenda BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own user_settings" ON public.user_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_settings_set_user_id BEFORE INSERT ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id();
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Commission fields on budgets
ALTER TABLE public.budgets
  ADD COLUMN commission_name TEXT,
  ADD COLUMN commission_percent NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN commission_value NUMERIC NOT NULL DEFAULT 0;

-- 5) company_id on all operational tables (nullable, backwards-compatible)
ALTER TABLE public.banks         ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.budgets       ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.employees     ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.metrics       ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.partners      ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.payables      ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.projects      ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.receivables   ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.suppliers     ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.time_entries  ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.transactions  ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX idx_budgets_company      ON public.budgets(company_id);
CREATE INDEX idx_payables_company     ON public.payables(company_id);
CREATE INDEX idx_receivables_company  ON public.receivables(company_id);
CREATE INDEX idx_transactions_company ON public.transactions(company_id);