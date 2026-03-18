
-- Config for auto-renewal based on referral count (per user)
CREATE TABLE IF NOT EXISTS public.indicacoes_auto_renovacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ativo BOOLEAN DEFAULT false,
  min_indicacoes INTEGER DEFAULT 3,
  periodo TEXT DEFAULT 'mensal',
  dias_renovacao INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.indicacoes_auto_renovacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own auto-renewal config"
  ON public.indicacoes_auto_renovacao FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_indicacoes_auto_renovacao_updated_at
  BEFORE UPDATE ON public.indicacoes_auto_renovacao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
