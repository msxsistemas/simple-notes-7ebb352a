
-- Planos SaaS do Sistema (gerenciados pelo admin)
CREATE TABLE public.system_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  intervalo text NOT NULL DEFAULT 'mensal', -- mensal, trimestral, anual
  limite_clientes integer DEFAULT 50,
  limite_mensagens integer DEFAULT 500,
  limite_whatsapp_sessions integer DEFAULT 1,
  limite_paineis integer DEFAULT 1,
  recursos jsonb DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  destaque boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" ON public.system_plans
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert plans" ON public.system_plans
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update plans" ON public.system_plans
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete plans" ON public.system_plans
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Assinaturas dos usuários
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid REFERENCES public.system_plans(id),
  status text NOT NULL DEFAULT 'ativa', -- ativa, cancelada, expirada, trial
  inicio timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz,
  gateway_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" ON public.user_subscriptions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert subscriptions" ON public.user_subscriptions
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update subscriptions" ON public.user_subscriptions
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete subscriptions" ON public.user_subscriptions
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Configurações globais do sistema
CREATE TABLE public.system_config (
  id integer PRIMARY KEY DEFAULT 1,
  nome_sistema text DEFAULT 'Gestor',
  manutencao boolean DEFAULT false,
  mensagem_manutencao text,
  registro_aberto boolean DEFAULT true,
  trial_dias integer DEFAULT 7,
  cor_primaria text DEFAULT '#6366f1',
  logo_url text,
  termos_url text,
  suporte_whatsapp text,
  suporte_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_config_single CHECK (id = 1)
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view system config" ON public.system_config
  FOR SELECT USING (true);

CREATE POLICY "Admins can update system config" ON public.system_config
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert system config" ON public.system_config
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default config
INSERT INTO public.system_config (id) VALUES (1);

-- Gateways globais do sistema
CREATE TABLE public.system_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  provedor text NOT NULL, -- asaas, mercadopago, stripe, v3pay, ciabra
  ativo boolean NOT NULL DEFAULT false,
  ambiente text NOT NULL DEFAULT 'sandbox', -- sandbox, producao
  api_key_hash text,
  public_key_hash text,
  webhook_url text,
  configuracoes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on gateways" ON public.system_gateways
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Templates padrão do sistema (copiados para novos usuários)
CREATE TABLE public.system_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL, -- bem_vindo, vencido, vence_hoje, proximo_vencer, confirmacao_pagamento, etc
  nome text NOT NULL,
  mensagem text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active templates" ON public.system_templates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage templates" ON public.system_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default templates
INSERT INTO public.system_templates (tipo, nome, mensagem) VALUES
  ('bem_vindo', 'Boas-vindas', 'Olá {nome}! Seja bem-vindo(a)! 🎉'),
  ('vencido', 'Vencido', 'Olá {nome}, sua assinatura venceu em {data_vencimento}. Renove agora!'),
  ('vence_hoje', 'Vence Hoje', 'Olá {nome}, sua assinatura vence hoje! Renove para não perder o acesso.'),
  ('proximo_vencer', 'Próximo a Vencer', 'Olá {nome}, sua assinatura vence em {data_vencimento}. Renove com antecedência!'),
  ('confirmacao_pagamento', 'Pagamento Confirmado', 'Olá {nome}, seu pagamento foi confirmado! ✅'),
  ('aniversario', 'Aniversário', 'Feliz aniversário {nome}! 🎂🎉');

-- Triggers para updated_at
CREATE TRIGGER update_system_plans_updated_at BEFORE UPDATE ON public.system_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_gateways_updated_at BEFORE UPDATE ON public.system_gateways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_templates_updated_at BEFORE UPDATE ON public.system_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
