
-- Tabela para rastrear cobranças criadas pelos gateways e vincular ao cliente
CREATE TABLE public.cobrancas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('v3pay', 'asaas', 'ciabra', 'mercadopago')),
  gateway_charge_id TEXT NOT NULL,
  cliente_whatsapp TEXT NOT NULL,
  cliente_nome TEXT,
  valor NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado', 'expirado')),
  renovado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cobrancas"
  ON public.cobrancas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cobrancas"
  ON public.cobrancas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cobrancas"
  ON public.cobrancas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cobrancas"
  ON public.cobrancas FOR DELETE
  USING (auth.uid() = user_id);

-- Service role precisa acessar para webhooks (sem auth do usuário)
CREATE POLICY "Service role full access on cobrancas"
  ON public.cobrancas FOR ALL
  USING (true)
  WITH CHECK (true);

-- Índices
CREATE INDEX idx_cobrancas_user_id ON public.cobrancas(user_id);
CREATE INDEX idx_cobrancas_gateway_charge_id ON public.cobrancas(gateway, gateway_charge_id);
CREATE INDEX idx_cobrancas_cliente_whatsapp ON public.cobrancas(cliente_whatsapp);
CREATE INDEX idx_cobrancas_status ON public.cobrancas(status);

-- Trigger para updated_at
CREATE TRIGGER update_cobrancas_updated_at
  BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION update_paineis_integracao_updated_at();
