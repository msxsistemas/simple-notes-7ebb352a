-- Create cupons table
CREATE TABLE public.cupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  desconto NUMERIC NOT NULL DEFAULT 0,
  tipo_desconto TEXT NOT NULL DEFAULT 'percentual', -- 'percentual' or 'fixo'
  limite_uso INTEGER,
  usos_atuais INTEGER NOT NULL DEFAULT 0,
  validade TIMESTAMP WITH TIME ZONE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint for codigo per user
CREATE UNIQUE INDEX cupons_codigo_user_unique ON public.cupons (user_id, UPPER(codigo));

-- Enable RLS
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own cupons" 
ON public.cupons FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cupons" 
ON public.cupons FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cupons" 
ON public.cupons FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cupons" 
ON public.cupons FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_cupons_updated_at
BEFORE UPDATE ON public.cupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indicacoes table to track referral rewards
CREATE TABLE public.indicacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cliente_indicado_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  codigo_indicacao TEXT NOT NULL,
  bonus NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'aprovado', 'pago'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own indicacoes" 
ON public.indicacoes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own indicacoes" 
ON public.indicacoes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own indicacoes" 
ON public.indicacoes FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_indicacoes_updated_at
BEFORE UPDATE ON public.indicacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();