
-- Remove overly permissive policy (service role bypasses RLS anyway)
DROP POLICY "Service role full access" ON public.cached_panel_sessions;
