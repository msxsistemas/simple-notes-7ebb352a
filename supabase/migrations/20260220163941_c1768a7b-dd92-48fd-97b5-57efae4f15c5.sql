-- Allow admins to view all indicacoes_auto_renovacao records
CREATE POLICY "Admins can view all indicacoes_auto_renovacao"
ON public.indicacoes_auto_renovacao
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert indicacoes_auto_renovacao for any user
CREATE POLICY "Admins can insert indicacoes_auto_renovacao"
ON public.indicacoes_auto_renovacao
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update indicacoes_auto_renovacao for any user
CREATE POLICY "Admins can update indicacoes_auto_renovacao"
ON public.indicacoes_auto_renovacao
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));