-- Allow admins to view all indicacoes
CREATE POLICY "Admins can view all indicacoes"
ON public.indicacoes
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update all indicacoes
CREATE POLICY "Admins can update all indicacoes"
ON public.indicacoes
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));