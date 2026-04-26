ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS discount_cash numeric NOT NULL DEFAULT 0;