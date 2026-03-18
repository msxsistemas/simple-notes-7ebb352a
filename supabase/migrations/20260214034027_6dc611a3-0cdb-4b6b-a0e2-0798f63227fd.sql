
CREATE TABLE public.envio_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tempo_minimo INTEGER NOT NULL DEFAULT 10,
  tempo_maximo INTEGER NOT NULL DEFAULT 15,
  limite_lote INTEGER NOT NULL DEFAULT 10,
  pausa_prolongada INTEGER NOT NULL DEFAULT 15,
  limite_diario INTEGER NULL,
  variar_intervalo BOOLEAN NOT NULL DEFAULT true,
  configuracoes_ativas BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.envio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own envio config"
  ON public.envio_config FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own envio config"
  ON public.envio_config FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own envio config"
  ON public.envio_config FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_envio_config_updated_at
  BEFORE UPDATE ON public.envio_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
