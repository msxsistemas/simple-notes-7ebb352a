
CREATE TABLE public.woovi_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id_hash text NOT NULL,
  is_configured boolean DEFAULT true,
  webhook_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.woovi_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own woovi config"
  ON public.woovi_config FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own woovi config"
  ON public.woovi_config FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own woovi config"
  ON public.woovi_config FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access woovi config"
  ON public.woovi_config FOR ALL
  TO service_role
  USING (true);
