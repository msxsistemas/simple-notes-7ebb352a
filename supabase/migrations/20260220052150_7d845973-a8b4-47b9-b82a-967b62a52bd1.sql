
-- Create referral discount history table
CREATE TABLE public.indicacoes_descontos_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  indicador_id UUID NOT NULL,
  indicador_nome TEXT NOT NULL,
  fatura_id UUID REFERENCES public.faturas(id) ON DELETE SET NULL,
  valor_original NUMERIC NOT NULL,
  valor_desconto NUMERIC NOT NULL,
  valor_final NUMERIC NOT NULL,
  tipo_desconto TEXT NOT NULL DEFAULT 'percentual',
  ciclo INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.indicacoes_descontos_log ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own discount logs"
  ON public.indicacoes_descontos_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all discount logs"
  ON public.indicacoes_descontos_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for performance
CREATE INDEX idx_indicacoes_descontos_log_user ON public.indicacoes_descontos_log(user_id);
CREATE INDEX idx_indicacoes_descontos_log_indicador ON public.indicacoes_descontos_log(indicador_id);
