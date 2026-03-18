-- Adicionar coluna user_id às tabelas principais
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE aplicativos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE planos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE templates_cobranca ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE mensagens_padroes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Remover políticas antigas
DROP POLICY IF EXISTS "Permitir todas as operações clientes" ON clientes;
DROP POLICY IF EXISTS "Permitir todas as operações aplicativos" ON aplicativos;
DROP POLICY IF EXISTS "Permitir todas as operações planos" ON planos;
DROP POLICY IF EXISTS "Permitir todas as operações produtos" ON produtos;
DROP POLICY IF EXISTS "Permitir todas as operações templates" ON templates_cobranca;
DROP POLICY IF EXISTS "Permitir todas as operações mensagens" ON mensagens_padroes;
DROP POLICY IF EXISTS "Permitir todas as operações configuracoes" ON configuracoes;

-- Políticas RLS para isolamento por usuário
CREATE POLICY "Users can only access their own clientes" ON clientes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own aplicativos" ON aplicativos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own planos" ON planos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own produtos" ON produtos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own templates" ON templates_cobranca
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own mensagens" ON mensagens_padroes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own configuracoes" ON configuracoes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own transacoes" ON transacoes
  FOR ALL USING (auth.uid() = user_id);

-- Habilitar RLS nas tabelas que ainda não têm
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;