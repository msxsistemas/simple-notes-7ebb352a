-- Tabela para armazenar transações financeiras
CREATE TABLE public.transacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao TEXT NOT NULL,
  data_transacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

-- Policies para isolamento de usuário
CREATE POLICY "Users can view their own transacoes" 
ON public.transacoes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transacoes" 
ON public.transacoes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transacoes" 
ON public.transacoes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transacoes" 
ON public.transacoes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_transacoes_updated_at 
  BEFORE UPDATE ON public.transacoes 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();