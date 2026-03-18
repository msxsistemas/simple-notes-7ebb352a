
-- Tabela para gerenciar status dos servidores pelo admin
CREATE TABLE IF NOT EXISTS public.system_servidores (
  id text NOT NULL PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'ativo',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Inserir servidores integrados
INSERT INTO public.system_servidores (id, nome, descricao, status) VALUES
  ('koffice-api', 'KOFFICE API', 'Integração kOfficePanel API', 'ativo'),
  ('koffice-v2', 'KOFFICE V2', 'Painel kOffice versão 2 (usuário/senha)', 'ativo'),
  ('sigma-v2', 'PAINEL SIGMA', 'Painel Sigma versão 2', 'ativo'),
  ('mundogf', 'MUNDOGF E FRANQUIAS', 'Painel MundoGF e Franquias', 'ativo'),
  ('uniplay', 'UNIPLAY E FRANQUIAS', 'Painel Uniplay e Franquias (IPTV e P2P)', 'ativo'),
  ('playfast', 'PLAYFAST', 'Painel IPTV Playfast', 'ativo')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.system_servidores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view servidores" ON public.system_servidores
  FOR SELECT USING (true);

CREATE POLICY "Admins can update servidores" ON public.system_servidores
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert servidores" ON public.system_servidores
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete servidores" ON public.system_servidores
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
