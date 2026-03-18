
-- Tabela de configuração V3Pay (PagBank)
CREATE TABLE public.v3pay_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  api_token_hash TEXT NOT NULL,
  is_configured BOOLEAN DEFAULT true,
  webhook_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint on user_id
ALTER TABLE public.v3pay_config ADD CONSTRAINT v3pay_config_user_id_key UNIQUE (user_id);

-- Enable RLS
ALTER TABLE public.v3pay_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own v3pay config"
  ON public.v3pay_config FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own v3pay config"
  ON public.v3pay_config FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own v3pay config"
  ON public.v3pay_config FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own v3pay config"
  ON public.v3pay_config FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_v3pay_config_updated_at
  BEFORE UPDATE ON public.v3pay_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
