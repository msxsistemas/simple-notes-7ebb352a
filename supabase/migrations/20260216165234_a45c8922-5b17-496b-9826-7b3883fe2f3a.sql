-- Remove overly permissive public SELECT policy on faturas
-- The edge function uses service_role_key which bypasses RLS,
-- so this public policy is unnecessary and exposes data
DROP POLICY IF EXISTS "Anyone can view faturas by id" ON public.faturas;