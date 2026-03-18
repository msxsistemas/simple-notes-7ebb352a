
-- Create Z-API config table to store per-user credentials
CREATE TABLE public.zapi_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  instance_id text NOT NULL,
  token text NOT NULL,
  client_token text NOT NULL,
  is_configured boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.zapi_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own zapi config"
  ON public.zapi_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own zapi config"
  ON public.zapi_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own zapi config"
  ON public.zapi_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own zapi config"
  ON public.zapi_config FOR DELETE
  USING (auth.uid() = user_id);
