-- Tabela para armazenar painéis de integração IPTV
CREATE TABLE IF NOT EXISTS paineis_integracao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  usuario TEXT NOT NULL,
  senha TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  auto_renovacao BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE paineis_integracao ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver apenas seus próprios painéis
CREATE POLICY "Users can view their own panels"
  ON paineis_integracao FOR SELECT
  USING (auth.uid() = user_id);

-- Usuários podem criar seus próprios painéis
CREATE POLICY "Users can create their own panels"
  ON paineis_integracao FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios painéis
CREATE POLICY "Users can update their own panels"
  ON paineis_integracao FOR UPDATE
  USING (auth.uid() = user_id);

-- Usuários podem deletar seus próprios painéis
CREATE POLICY "Users can delete their own panels"
  ON paineis_integracao FOR DELETE
  USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX idx_paineis_integracao_user_id ON paineis_integracao(user_id);
CREATE INDEX idx_paineis_integracao_status ON paineis_integracao(status);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_paineis_integracao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_paineis_integracao_updated_at_trigger
  BEFORE UPDATE ON paineis_integracao
  FOR EACH ROW
  EXECUTE FUNCTION update_paineis_integracao_updated_at();
