
-- Replace dias_renovacao with discount fields
ALTER TABLE public.indicacoes_auto_renovacao 
  ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC DEFAULT 10,
  ADD COLUMN IF NOT EXISTS tipo_desconto TEXT DEFAULT 'percentual';

ALTER TABLE public.indicacoes_auto_renovacao 
  DROP COLUMN IF EXISTS dias_renovacao;
