
-- Table for notification configuration per user
CREATE TABLE public.notificacoes_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  hora_notificacoes TEXT NOT NULL DEFAULT '08:00',
  dias_gerar_fatura INTEGER NOT NULL DEFAULT 3,
  dias_proximo_vencer INTEGER NOT NULL DEFAULT 0,
  valor_taxa_pagamento NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  api_chatbot TEXT DEFAULT '',
  quantidade_mensagens INTEGER NOT NULL DEFAULT 7,
  dias_apos_vencimento INTEGER NOT NULL DEFAULT 2,
  whatsapp_pagamentos TEXT DEFAULT '',
  descontar_saldo_fatura BOOLEAN NOT NULL DEFAULT true,
  notif_bem_vindo BOOLEAN NOT NULL DEFAULT true,
  notif_fatura_criada BOOLEAN NOT NULL DEFAULT true,
  notif_vencendo_hoje BOOLEAN NOT NULL DEFAULT true,
  notif_confirmacao_pagamento BOOLEAN NOT NULL DEFAULT true,
  notif_aniversario BOOLEAN NOT NULL DEFAULT true,
  notif_indicacao BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.notificacoes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own config" ON public.notificacoes_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own config" ON public.notificacoes_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own config" ON public.notificacoes_config FOR UPDATE USING (auth.uid() = user_id);
