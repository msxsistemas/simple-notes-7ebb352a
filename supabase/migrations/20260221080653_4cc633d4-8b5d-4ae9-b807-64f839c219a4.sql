ALTER TABLE public.paineis_integracao 
ADD COLUMN IF NOT EXISTS proxy_session_id text DEFAULT NULL;