-- Table for withdrawal requests
CREATE TABLE public.saques_indicacao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  valor numeric NOT NULL,
  chave_pix text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  motivo_rejeicao text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saques_indicacao ENABLE ROW LEVEL SECURITY;

-- Users can view their own
CREATE POLICY "Users can view their own saques"
ON public.saques_indicacao FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own
CREATE POLICY "Users can insert their own saques"
ON public.saques_indicacao FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all saques"
ON public.saques_indicacao FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update all
CREATE POLICY "Admins can update all saques"
ON public.saques_indicacao FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_saques_indicacao_updated_at
BEFORE UPDATE ON public.saques_indicacao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add PIX key column to profiles for persistence
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS chave_pix_indicacao text;