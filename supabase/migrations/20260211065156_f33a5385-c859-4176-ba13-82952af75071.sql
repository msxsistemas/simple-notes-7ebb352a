-- Adicionar coluna tipo_servico na tabela produtos (IPTV ou P2P)
ALTER TABLE public.produtos
ADD COLUMN tipo_servico TEXT NOT NULL DEFAULT 'iptv' CHECK (tipo_servico IN ('iptv', 'p2p'));