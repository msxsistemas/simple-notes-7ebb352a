-- Update the create_default_templates function to remove 'Dados de acesso do cliente'
CREATE OR REPLACE FUNCTION create_default_templates(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO templates_cobranca (nome, mensagem, incluir_cartao, incluir_chave_pix, chave_pix, user_id)
  VALUES
    ('Confirmação de Pagamento', 'Olá {nome}! Confirmamos o recebimento do seu pagamento de R$ {valor}.

Seu plano {plano} está ativo até {data_vencimento}.

Obrigado pela preferência!', false, false, '', target_user_id),
    ('Plano Venceu Ontem', 'Olá {nome}, seu plano {plano} venceu ontem ({data_vencimento}).

Por favor, renove para continuar aproveitando nossos serviços.

Valor: R$ {valor}', false, true, '', target_user_id),
    ('Plano Vencendo Hoje', '{saudacao}, {nome}

⚠️ SEU VENCIMENTO É HOJE! Pra continuar aproveitando seus canais, realize o pagamento o quanto antes.

DADOS DA FATURA:

🔹 Vencimento: {vencimento}
🔸 {plano}: {valor_plano}
🔹 Desconto: ~{desconto}~
🔸 Total a pagar: {total}

👉🏼 Pagamento rápido em 1 clique: copie o pix e cole no aplicativo do banco. 

Nome: SEUNOME
Banco: SEUBANCO
Pix: COLOQUE SEU PIX

⚠️ Qualquer dúvida ou dificuldade, é só nos avisar aqui no mesmo instante!', false, true, '', target_user_id),
    ('Plano Vencendo Amanhã', 'Olá {nome}, seu plano {plano} vence amanhã ({data_vencimento}).

Antecipe sua renovação e garanta seu acesso!

Valor: R$ {valor}', false, true, '', target_user_id),
    ('Fatura Criada', 'Olá {nome}! Uma nova fatura foi gerada para você.

Plano: {plano}
Valor: R$ {valor}
Vencimento: {data_vencimento}

Realize o pagamento para manter seu acesso ativo!', false, true, '', target_user_id),
    ('Bem-vindo', 'Bem-vindo(a) {nome}!

Estamos felizes em tê-lo conosco!

Seu plano {plano} está ativo e pronto para uso.

Qualquer dúvida, estamos à disposição!', false, false, '', target_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Remove existing 'Dados de acesso do cliente' templates from all users
DELETE FROM templates_cobranca WHERE nome = 'Dados de acesso do cliente';