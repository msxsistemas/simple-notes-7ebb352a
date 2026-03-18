-- Tabela de templates de mensagens WhatsApp
CREATE TABLE public.templates_mensagens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  midia BOOLEAN DEFAULT false,
  padrao BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.templates_mensagens ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para isolamento por usuário
CREATE POLICY "Users can view their own templates_mensagens"
ON public.templates_mensagens
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates_mensagens"
ON public.templates_mensagens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates_mensagens"
ON public.templates_mensagens
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates_mensagens"
ON public.templates_mensagens
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_templates_mensagens_updated_at
BEFORE UPDATE ON public.templates_mensagens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();