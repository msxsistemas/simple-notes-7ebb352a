
-- Remover a policy permissiva e criar uma mais segura apenas para service role
DROP POLICY IF EXISTS "Service role full access on cobrancas" ON public.cobrancas;

-- Nota: O service_role key bypassa RLS automaticamente no Supabase,
-- então não precisamos de uma policy especial. As policies existentes
-- por user_id já são suficientes para acesso autenticado.
