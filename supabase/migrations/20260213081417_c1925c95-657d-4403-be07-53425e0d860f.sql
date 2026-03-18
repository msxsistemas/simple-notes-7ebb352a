
-- Update create_default_templates to copy system_templates into mensagens_padroes
CREATE OR REPLACE FUNCTION create_default_templates(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bem_vindo text;
  v_fatura_criada text;
  v_proximo_vencer text;
  v_vence_hoje text;
  v_vencido text;
  v_confirmacao_pagamento text;
BEGIN
  -- Read active system_templates by tipo
  SELECT mensagem INTO v_bem_vindo FROM system_templates WHERE tipo = 'bem_vindo' AND ativo = true LIMIT 1;
  SELECT mensagem INTO v_fatura_criada FROM system_templates WHERE tipo = 'fatura_criada' AND ativo = true LIMIT 1;
  SELECT mensagem INTO v_proximo_vencer FROM system_templates WHERE tipo = 'proximo_vencer' AND ativo = true LIMIT 1;
  SELECT mensagem INTO v_vence_hoje FROM system_templates WHERE tipo = 'vence_hoje' AND ativo = true LIMIT 1;
  SELECT mensagem INTO v_vencido FROM system_templates WHERE tipo = 'vencido' AND ativo = true LIMIT 1;
  SELECT mensagem INTO v_confirmacao_pagamento FROM system_templates WHERE tipo = 'confirmacao_pagamento' AND ativo = true LIMIT 1;

  -- Insert into mensagens_padroes for the new user
  INSERT INTO mensagens_padroes (user_id, bem_vindo, fatura_criada, proximo_vencer, vence_hoje, vencido, confirmacao_pagamento, updated_at)
  VALUES (
    target_user_id,
    v_bem_vindo,
    v_fatura_criada,
    v_proximo_vencer,
    v_vence_hoje,
    v_vencido,
    v_confirmacao_pagamento,
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
