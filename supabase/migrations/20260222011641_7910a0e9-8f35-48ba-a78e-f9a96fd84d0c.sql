
-- Tabela para cachear sessões/tokens de painéis após login bem-sucedido
CREATE TABLE public.cached_panel_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  painel_id TEXT NOT NULL,
  provedor TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'jwt',
  cookies TEXT,
  extra_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '12 hours'),
  UNIQUE(user_id, painel_id)
);

-- RLS
ALTER TABLE public.cached_panel_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own cached sessions"
ON public.cached_panel_sessions
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Service role pode acessar tudo (para edge functions)
CREATE POLICY "Service role full access"
ON public.cached_panel_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Index para busca rápida
CREATE INDEX idx_cached_panel_sessions_lookup ON public.cached_panel_sessions(user_id, painel_id, provedor);

-- Auto-limpar sessões expiradas
CREATE OR REPLACE FUNCTION public.cleanup_expired_panel_sessions()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.cached_panel_sessions WHERE expires_at < now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER cleanup_expired_sessions
AFTER INSERT ON public.cached_panel_sessions
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_panel_sessions();
