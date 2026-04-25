-- 1. Atualiza time_entries
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS lunch_out time,
  ADD COLUMN IF NOT EXISTS lunch_in time,
  ADD COLUMN IF NOT EXISTS pay_type text NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS daily_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

-- 2. Atualiza employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS pay_type text NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS daily_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_salary numeric NOT NULL DEFAULT 0;

-- 3. Nova tabela projects (produtividade)
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  client text,
  responsible text,
  status text NOT NULL DEFAULT 'em_andamento',
  deadline date,
  progress integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own projects"
  ON public.projects
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
