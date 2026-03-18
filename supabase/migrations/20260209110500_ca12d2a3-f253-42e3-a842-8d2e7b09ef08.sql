
-- Adicionar coluna provedor à tabela paineis_integracao
ALTER TABLE public.paineis_integracao ADD COLUMN IF NOT EXISTS provedor TEXT NOT NULL DEFAULT 'playfast';

-- Índice para filtrar por provedor
CREATE INDEX IF NOT EXISTS idx_paineis_integracao_provedor ON paineis_integracao(provedor);
