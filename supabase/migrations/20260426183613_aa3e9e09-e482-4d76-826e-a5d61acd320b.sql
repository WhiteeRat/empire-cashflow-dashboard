-- Tax settings (uma linha por empresa do usuário, ou geral se company_id null)
CREATE TABLE public.tax_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID,
  regime TEXT NOT NULL DEFAULT 'simples_nacional',
  cnae_main TEXT,
  cnae_secondary TEXT[],
  annual_limit NUMERIC NOT NULL DEFAULT 4800000,
  alert_yellow_percent NUMERIC NOT NULL DEFAULT 80,
  alert_red_percent NUMERIC NOT NULL DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own tax_settings" ON public.tax_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_tax_settings_updated
  BEFORE UPDATE ON public.tax_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Informes de rendimentos importados
CREATE TABLE public.income_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID,
  base_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now())::INT,
  source_name TEXT NOT NULL,
  source_cnpj TEXT,
  taxable_income NUMERIC NOT NULL DEFAULT 0,
  exempt_income NUMERIC NOT NULL DEFAULT 0,
  ir_withheld NUMERIC NOT NULL DEFAULT 0,
  contributions NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  origin TEXT NOT NULL DEFAULT 'manual',
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.income_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own income_statements" ON public.income_statements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_income_statements_updated
  BEFORE UPDATE ON public.income_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notas fiscais emitidas (registro leve)
CREATE TABLE public.nf_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID,
  receivable_id UUID,
  number TEXT,
  series TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  client TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.nf_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own nf_records" ON public.nf_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_income_statements_user_year ON public.income_statements(user_id, base_year);
CREATE INDEX idx_nf_records_user_date ON public.nf_records(user_id, issue_date);