
CREATE TABLE public.mercadopago_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token_hash TEXT NOT NULL,
  webhook_url TEXT,
  is_configured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mercadopago_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mp config"
  ON public.mercadopago_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mp config"
  ON public.mercadopago_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mp config"
  ON public.mercadopago_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_mercadopago_config_updated_at
  BEFORE UPDATE ON public.mercadopago_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
