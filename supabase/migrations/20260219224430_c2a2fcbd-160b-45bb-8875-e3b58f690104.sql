
-- Create v3pay_pj_config table (identical structure to v3pay_config)
CREATE TABLE public.v3pay_pj_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  api_token_hash TEXT NOT NULL,
  is_configured BOOLEAN DEFAULT true,
  webhook_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on user_id
ALTER TABLE public.v3pay_pj_config ADD CONSTRAINT v3pay_pj_config_user_id_key UNIQUE (user_id);

-- Enable RLS
ALTER TABLE public.v3pay_pj_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own v3pay_pj config"
  ON public.v3pay_pj_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own v3pay_pj config"
  ON public.v3pay_pj_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own v3pay_pj config"
  ON public.v3pay_pj_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own v3pay_pj config"
  ON public.v3pay_pj_config FOR DELETE
  USING (auth.uid() = user_id);
