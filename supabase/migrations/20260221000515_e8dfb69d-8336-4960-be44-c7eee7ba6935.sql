
-- Add columns for device binding and verification status for UniTV integration
ALTER TABLE public.paineis_integracao 
  ADD COLUMN IF NOT EXISTS dispositivo TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verificacao_status TEXT NOT NULL DEFAULT 'pendente' CHECK (verificacao_status IN ('pendente', 'verificado', 'vinculado')),
  ADD COLUMN IF NOT EXISTS dispositivo_id TEXT DEFAULT NULL;
