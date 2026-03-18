-- Add renovacao_pendente flag to clientes table
-- When Sigma renewal fails server-side, this flag is set so the frontend can retry
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS renovacao_pendente boolean DEFAULT false;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS renovacao_pendente_dados jsonb DEFAULT null;