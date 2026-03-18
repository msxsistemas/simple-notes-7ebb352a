-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  data_vencimento TIMESTAMP,
  fixo BOOLEAN DEFAULT false,
  usuario TEXT,
  senha TEXT,
  produto TEXT,
  plano TEXT,
  app TEXT,
  data_venc_app TEXT,
  telas INTEGER DEFAULT 1,
  mac TEXT,
  dispositivo TEXT,
  fatura TEXT DEFAULT 'Pago',
  key TEXT,
  mensagem TEXT,
  lembretes BOOLEAN DEFAULT false,
  indicador TEXT,
  desconto TEXT DEFAULT '0,00',
  desconto_recorrente BOOLEAN DEFAULT false,
  aniversario TEXT,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de aplicativos
CREATE TABLE IF NOT EXISTS aplicativos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de planos
CREATE TABLE IF NOT EXISTS planos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  valor TEXT NOT NULL,
  tipo TEXT DEFAULT 'meses',
  quantidade TEXT,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  valor TEXT NOT NULL,
  creditos TEXT,
  descricao TEXT,
  configuracoes_iptv BOOLEAN DEFAULT false,
  provedor_iptv TEXT,
  renovacao_automatica BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de templates de cobrança
CREATE TABLE IF NOT EXISTS templates_cobranca (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  incluir_cartao BOOLEAN DEFAULT false,
  incluir_chave_pix BOOLEAN DEFAULT false,
  chave_pix TEXT,
  midia_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de mensagens padrões (singleton)
CREATE TABLE IF NOT EXISTS mensagens_padroes (
  id INTEGER PRIMARY KEY DEFAULT 1,
  confirmacao_cliente TEXT,
  expiracao_app TEXT,
  aniversario_cliente TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- RLS (Row Level Security) - Habilitar para todas as tabelas
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE aplicativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates_cobranca ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_padroes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas (permitir todas as operações por enquanto)
CREATE POLICY "Permitir todas as operações clientes" ON clientes FOR ALL USING (true);
CREATE POLICY "Permitir todas as operações aplicativos" ON aplicativos FOR ALL USING (true);
CREATE POLICY "Permitir todas as operações planos" ON planos FOR ALL USING (true);
CREATE POLICY "Permitir todas as operações produtos" ON produtos FOR ALL USING (true);
CREATE POLICY "Permitir todas as operações templates" ON templates_cobranca FOR ALL USING (true);
CREATE POLICY "Permitir todas as operações mensagens" ON mensagens_padroes FOR ALL USING (true);