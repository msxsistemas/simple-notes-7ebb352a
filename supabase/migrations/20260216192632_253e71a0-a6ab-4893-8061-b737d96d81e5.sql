
-- Fix warn: notificacoes - restrict SELECT to own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notificacoes;
CREATE POLICY "Users can view their own notifications"
ON public.notificacoes FOR SELECT
USING (auth.uid() = user_id);

-- Fix warn: logs_sistema - restrict SELECT to own + admin
DROP POLICY IF EXISTS "Users can view their own system logs" ON public.logs_sistema;
DROP POLICY IF EXISTS "Admins can view all system logs" ON public.logs_sistema;
CREATE POLICY "Users can view their own system logs"
ON public.logs_sistema FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
