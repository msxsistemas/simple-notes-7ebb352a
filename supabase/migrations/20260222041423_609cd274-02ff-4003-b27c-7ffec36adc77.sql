
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo_painel TEXT DEFAULT NULL;
COMMENT ON COLUMN public.clientes.tipo_painel IS 'Tipo de serviço no painel: iptv ou p2p';
