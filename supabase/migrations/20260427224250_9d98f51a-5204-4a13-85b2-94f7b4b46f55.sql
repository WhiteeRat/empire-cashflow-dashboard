-- =====================================================
-- FASE 1: Sistema de Planos + Bloqueio de Abas
-- =====================================================

-- 1) ENUM de papéis (super_admin, admin, user)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'user');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Tabela user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3) Função has_role (security definer evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4) RLS user_roles
DROP POLICY IF EXISTS "users view own roles" ON public.user_roles;
CREATE POLICY "users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "super_admin manage roles" ON public.user_roles;
CREATE POLICY "super_admin manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 5) Catálogo de planos do SaaS
CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,                       -- 'junior' | 'senior' | 'societaria' | 'contabil'
  name text NOT NULL,
  description text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_one_time numeric,                    -- usado p/ contábil avulso (R$129)
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,-- chaves de módulos liberados
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone authenticated can read plans" ON public.plans;
CREATE POLICY "anyone authenticated can read plans" ON public.plans
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "super_admin manages plans" ON public.plans;
CREATE POLICY "super_admin manages plans" ON public.plans
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Seed dos 4 planos
INSERT INTO public.plans (id, name, description, price_monthly, price_one_time, modules) VALUES
  ('junior',     'Gestão Junior + Consultoria Direta',     'Acesso essencial: Fluxo, DRE e Dashboard',       410.00, NULL, '["dashboard","dre","fluxo"]'::jsonb),
  ('senior',     'Gestão Sênior + Consultoria Direta',     'Gestão completa + IA de crescimento',           649.00, NULL, '["dashboard","dre","fluxo","orcamentos","metricas","equipe","produtividade","imperar"]'::jsonb),
  ('societaria', 'Gestão Societária + Consultoria Direta', 'Acesso à Diretoria',                             25.99, NULL, '["diretoria"]'::jsonb),
  ('contabil',   'Gestão Contábil + Consultoria Direta',   'Contabilidade mensal ou avulsa',                 49.99, 129.00, '["contabilidade"]'::jsonb)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      price_monthly = EXCLUDED.price_monthly,
      price_one_time = EXCLUDED.price_one_time,
      modules = EXCLUDED.modules,
      updated_at = now();

-- 6) Assinaturas por empresa (uma empresa pode ter vários planos ativos)
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,                       -- null = sem expiração
  granted_by uuid,                           -- super_admin que liberou
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, plan_id)
);
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

-- O dono da empresa lê suas assinaturas; super_admin lê e gerencia tudo
DROP POLICY IF EXISTS "owner reads subscriptions" ON public.company_subscriptions;
CREATE POLICY "owner reads subscriptions" ON public.company_subscriptions
  FOR SELECT USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "super_admin manages subscriptions" ON public.company_subscriptions;
CREATE POLICY "super_admin manages subscriptions" ON public.company_subscriptions
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 7) Override por empresa (admin pode habilitar/desabilitar módulos manualmente)
CREATE TABLE IF NOT EXISTS public.company_module_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, module_key)
);
ALTER TABLE public.company_module_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads overrides" ON public.company_module_overrides;
CREATE POLICY "owner reads overrides" ON public.company_module_overrides
  FOR SELECT USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "super_admin manages overrides" ON public.company_module_overrides;
CREATE POLICY "super_admin manages overrides" ON public.company_module_overrides
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 8) Trigger updated_at
DROP TRIGGER IF EXISTS trg_plans_updated_at ON public.plans;
CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_subs_updated_at ON public.company_subscriptions;
CREATE TRIGGER trg_subs_updated_at BEFORE UPDATE ON public.company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9) Atribuir super_admin ao e-mail autorizado (se já existir)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'pedrohenriqueph7879@gmail.com'
ON CONFLICT DO NOTHING;

-- 10) Trigger: quando esse e-mail criar conta, vira super_admin automaticamente
CREATE OR REPLACE FUNCTION public.assign_super_admin_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'pedrohenriqueph7879@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_super_admin_on_signup();