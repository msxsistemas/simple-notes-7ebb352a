-- Tabela de configurações (singleton)
CREATE TABLE IF NOT EXISTS configuracoes (
  id INTEGER PRIMARY KEY DEFAULT 1,
  cobrancas_ativas BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT configuracoes_single_row CHECK (id = 1)
);

-- Habilitar RLS e política aberta (ajuste conforme necessário)
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todas as operações configuracoes" ON configuracoes FOR ALL USING (true);
