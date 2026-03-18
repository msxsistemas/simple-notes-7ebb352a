
-- Gateway rotation config: allows alternating between 2 gateways every X invoices
CREATE TABLE public.gateway_rotation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT false,
  gateway_a TEXT NOT NULL DEFAULT 'asaas',
  gateway_b TEXT NOT NULL DEFAULT 'v3pay',
  intervalo INTEGER NOT NULL DEFAULT 5,
  contador_atual INTEGER NOT NULL DEFAULT 0,
  gateway_atual TEXT NOT NULL DEFAULT 'a',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_rotation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rotation config"
  ON public.gateway_rotation_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rotation config"
  ON public.gateway_rotation_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rotation config"
  ON public.gateway_rotation_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_gateway_rotation_config_updated_at
  BEFORE UPDATE ON public.gateway_rotation_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
