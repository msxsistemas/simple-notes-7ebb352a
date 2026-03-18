
-- Tabela para configurações do sistema de indicações
CREATE TABLE IF NOT EXISTS public.system_indicacoes_config (
  id integer NOT NULL DEFAULT 1 PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT true,
  valor_bonus numeric NOT NULL DEFAULT 5.00,
  tipo_bonus text NOT NULL DEFAULT 'fixo',
  descricao text DEFAULT 'Indique amigos e ganhe bônus por cada indicação aprovada!',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO public.system_indicacoes_config (id, ativo, valor_bonus, tipo_bonus, descricao)
VALUES (1, true, 5.00, 'fixo', 'Indique amigos e ganhe bônus por cada indicação aprovada!')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_indicacoes_config ENABLE ROW LEVEL SECURITY;

-- Políticas: qualquer um pode ver, só admin pode modificar
CREATE POLICY "Anyone can view indicacoes config" ON public.system_indicacoes_config
  FOR SELECT USING (true);

CREATE POLICY "Admins can update indicacoes config" ON public.system_indicacoes_config
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert indicacoes config" ON public.system_indicacoes_config
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
