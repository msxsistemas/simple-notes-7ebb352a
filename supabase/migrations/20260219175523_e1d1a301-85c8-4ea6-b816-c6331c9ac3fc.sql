
CREATE TABLE IF NOT EXISTS public.woovi_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  app_id_hash text NOT NULL DEFAULT '',
  is_configured boolean DEFAULT false,
  webhook_url text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.woovi_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own woovi config"
  ON public.woovi_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own woovi config"
  ON public.woovi_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own woovi config"
  ON public.woovi_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_woovi_config_updated_at
  BEFORE UPDATE ON public.woovi_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
