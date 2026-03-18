-- Create tables if not exist for the app
-- Enable required extension
create extension if not exists pgcrypto;

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS public.clientes (
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
CREATE TABLE IF NOT EXISTS public.aplicativos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de planos
CREATE TABLE IF NOT EXISTS public.planos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  valor TEXT NOT NULL,
  tipo TEXT DEFAULT 'meses',
  quantidade TEXT,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS public.produtos (
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
CREATE TABLE IF NOT EXISTS public.templates_cobranca (
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
CREATE TABLE IF NOT EXISTS public.mensagens_padroes (
  id INTEGER PRIMARY KEY DEFAULT 1,
  confirmacao_cliente TEXT,
  expiracao_app TEXT,
  aniversario_cliente TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Enable Row Level Security
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aplicativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_cobranca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_padroes ENABLE ROW LEVEL SECURITY;

-- Permissive policies for now (can be tightened later)
DO $$ BEGIN
  CREATE POLICY "Permitir todas as operações clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Permitir todas as operações aplicativos" ON public.aplicativos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Permitir todas as operações planos" ON public.planos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Permitir todas as operações produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Permitir todas as operações templates" ON public.templates_cobranca FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Permitir todas as operações mensagens" ON public.mensagens_padroes FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;