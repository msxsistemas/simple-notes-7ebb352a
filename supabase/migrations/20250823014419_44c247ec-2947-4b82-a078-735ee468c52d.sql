-- Criar tabela para configurações do Asaas
CREATE TABLE public.asaas_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  api_key_hash TEXT NOT NULL,
  webhook_url TEXT,
  is_configured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.asaas_config ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own asaas config" 
ON public.asaas_config 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own asaas config" 
ON public.asaas_config 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own asaas config" 
ON public.asaas_config 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own asaas config" 
ON public.asaas_config 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_asaas_config_updated_at
BEFORE UPDATE ON public.asaas_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();