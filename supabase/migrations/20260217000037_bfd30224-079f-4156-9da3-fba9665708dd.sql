-- Remove the overly permissive public SELECT policy on faturas
DROP POLICY IF EXISTS "Anyone can view faturas by id" ON public.faturas;