
-- Remove overly permissive "service role" policies from cobrancas
-- These use USING(true)/WITH CHECK(true) which allows unrestricted access

DROP POLICY IF EXISTS "Service role can insert cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "Service role can select cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "Service role can update cobrancas" ON public.cobrancas;
