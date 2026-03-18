
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS valor_original numeric NULL;
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS cupom_codigo text NULL;
