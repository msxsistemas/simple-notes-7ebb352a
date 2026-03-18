-- Adicionar campo ativo na tabela clientes
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;