-- ============================================
-- EVOLUÇÃO ERP: Diretoria, Distribuição, Sangria, Auditoria
-- Mantém retrocompatibilidade total com dados existentes
-- ============================================

-- 1) Estender partners (sócios/diretoria) — TODAS as colunas adicionadas com defaults seguros
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS document text,                      -- CPF ou CNPJ
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'Sócio',          -- Cargo/Função
  ADD COLUMN IF NOT EXISTS pro_labore numeric NOT NULL DEFAULT 0, -- Pró-labore mensal
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 2) Tabela de distribuições de lucro (cabeçalho)
CREATE TABLE IF NOT EXISTS public.profit_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_label text NOT NULL,                  -- "Mensal 03/2026", "Trimestre Q1/2026" etc
  revenue numeric NOT NULL DEFAULT 0,
  expenses numeric NOT NULL DEFAULT 0,
  taxes numeric NOT NULL DEFAULT 0,
  costs numeric NOT NULL DEFAULT 0,
  net_profit numeric NOT NULL DEFAULT 0,
  total_distributed numeric NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'proporcional',   -- 'proporcional' | 'manual'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profit_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profit_distributions" ON public.profit_distributions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3) Itens de distribuição por sócio
CREATE TABLE IF NOT EXISTS public.partner_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  distribution_id uuid NOT NULL REFERENCES public.profit_distributions(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL,
  partner_name text NOT NULL,
  share_percent numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own partner_distributions" ON public.partner_distributions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) Sangria / retiradas dos sócios
CREATE TABLE IF NOT EXISTS public.partner_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  partner_id uuid NOT NULL,
  partner_name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  bank_id uuid,
  -- Quando true, foi descontada/considerada no pró-labore do mês
  applied_to_prolabore boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own partner_withdrawals" ON public.partner_withdrawals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5) Log de auditoria para informes (income_statements)
CREATE TABLE IF NOT EXISTS public.income_statement_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  statement_id uuid,                         -- pode ser nulo após exclusão
  action text NOT NULL,                      -- 'update' | 'delete'
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.income_statement_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own income_statement_audit" ON public.income_statement_audit
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6) Toggle: vincular faturamento contábil ao dashboard
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS link_accounting_to_dashboard boolean NOT NULL DEFAULT false;

-- 7) Índices úteis
CREATE INDEX IF NOT EXISTS idx_partner_withdrawals_date ON public.partner_withdrawals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_profit_distributions_period ON public.profit_distributions(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_partner_distributions_dist ON public.partner_distributions(distribution_id);
CREATE INDEX IF NOT EXISTS idx_income_statements_year ON public.income_statements(user_id, base_year);