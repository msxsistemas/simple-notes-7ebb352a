-- Adicionar coluna 'ativo' na tabela planos
ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;

-- Adicionar coluna 'ativo' na tabela aplicativos
ALTER TABLE public.aplicativos ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;

-- Adicionar coluna 'ativo' na tabela produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;