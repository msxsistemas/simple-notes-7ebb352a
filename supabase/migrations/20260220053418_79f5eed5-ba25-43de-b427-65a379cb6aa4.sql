-- Add indicacao_convite column for message when someone is referred
ALTER TABLE public.mensagens_padroes
ADD COLUMN indicacao_convite TEXT DEFAULT 'Olá {nome}! 👋{br}{br}Você foi indicado por {indicador} para nosso serviço! 🎉{br}{br}Seja bem-vindo(a) e aproveite todos os nossos recursos! 🚀';

-- Update create_default_templates to include the new fields
CREATE OR REPLACE FUNCTION public.create_default_templates(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bem_vindo text;
  v_fatura_criada text;
  v_proximo_vencer text;
  v_vence_hoje text;
  v_vencido text;
  v_confirmacao_pagamento text;
  v_indicacao_meta text;
  v_indicacao_convite text;
BEGIN
  SELECT mensagem INTO v_bem_vindo FROM system_templates WHERE tipo = 'bem_vindo' AND ativo = true LIMIT 1;
  SELECT mensagem INTO v_fatura_criada FROM system_templates WHERE tipo = 'fatura_criada' AND ativo = true LIMIT 1;
  SELECT mensagem INTO v_proximo_vencer FROM system_templates WHERE tipo = 'proximo_vencer' AND ativo = true LIMIT 1;
  SELECT mensagem INTO v_vence_hoje FROM system_templates WHERE tipo = 'vence_hoje' AND ativo = true LIMIT 1;
  SELECT mensagem INTO v_vencido FROM system_templates WHERE tipo = 'vencido' AND ativo = true LIMIT 1;
  SELECT mensagem INTO v_confirmacao_pagamento FROM system_templates WHERE tipo = 'confirmacao_pagamento' AND ativo = true LIMIT 1;
  SELECT mensagem INTO v_indicacao_meta FROM system_templates WHERE tipo = 'indicacao_meta' AND ativo = true LIMIT 1;
  SELECT mensagem INTO v_indicacao_convite FROM system_templates WHERE tipo = 'indicacao_convite' AND ativo = true LIMIT 1;

  INSERT INTO mensagens_padroes (user_id, bem_vindo, fatura_criada, proximo_vencer, vence_hoje, vencido, confirmacao_pagamento, indicacao_meta, indicacao_convite, updated_at)
  VALUES (
    target_user_id,
    v_bem_vindo,
    v_fatura_criada,
    v_proximo_vencer,
    v_vence_hoje,
    v_vencido,
    v_confirmacao_pagamento,
    v_indicacao_meta,
    v_indicacao_convite,
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$function$;