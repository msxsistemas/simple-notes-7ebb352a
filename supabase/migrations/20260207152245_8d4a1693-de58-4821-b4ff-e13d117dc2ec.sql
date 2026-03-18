-- Adicionar novas colunas para mensagens gerenciáveis
ALTER TABLE public.mensagens_padroes 
ADD COLUMN IF NOT EXISTS bem_vindo TEXT,
ADD COLUMN IF NOT EXISTS fatura_criada TEXT,
ADD COLUMN IF NOT EXISTS proximo_vencer TEXT,
ADD COLUMN IF NOT EXISTS vence_hoje TEXT,
ADD COLUMN IF NOT EXISTS vencido TEXT,
ADD COLUMN IF NOT EXISTS confirmacao_pagamento TEXT,
ADD COLUMN IF NOT EXISTS dados_cliente TEXT;