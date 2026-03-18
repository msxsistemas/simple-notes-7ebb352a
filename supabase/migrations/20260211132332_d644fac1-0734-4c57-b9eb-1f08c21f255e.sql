
-- Tabela de faturas para links de pagamento
CREATE TABLE public.faturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT NOT NULL,
  cliente_whatsapp TEXT NOT NULL,
  plano_nome TEXT,
  valor NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  gateway TEXT,
  gateway_charge_id TEXT,
  pix_qr_code TEXT,
  pix_copia_cola TEXT,
  pix_manual_key TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;

-- Owner pode gerenciar suas faturas
CREATE POLICY "Users can view their own faturas"
  ON public.faturas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own faturas"
  ON public.faturas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own faturas"
  ON public.faturas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own faturas"
  ON public.faturas FOR DELETE
  USING (auth.uid() = user_id);

-- Acesso público para visualização da fatura (clientes acessam pelo link)
CREATE POLICY "Anyone can view faturas by id"
  ON public.faturas FOR SELECT
  USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_faturas_updated_at
  BEFORE UPDATE ON public.faturas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
