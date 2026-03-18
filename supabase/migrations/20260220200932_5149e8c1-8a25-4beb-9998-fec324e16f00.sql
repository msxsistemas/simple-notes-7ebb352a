INSERT INTO public.system_servidores (id, nome, descricao, status)
VALUES ('unitv', 'UNITV', 'Painel UniTV - ResellerSystem (IPTV)', 'ativo')
ON CONFLICT (id) DO UPDATE SET nome = 'UNITV', descricao = 'Painel UniTV - ResellerSystem (IPTV)', status = 'ativo';