-- Create table for panel logs (user actions in the panel)
CREATE TABLE public.logs_painel (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  acao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for system logs (technical events)
CREATE TABLE public.logs_sistema (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  componente TEXT NOT NULL,
  evento TEXT NOT NULL,
  nivel TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.logs_painel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;

-- RLS policies for logs_painel
CREATE POLICY "Users can view their own panel logs"
ON public.logs_painel FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own panel logs"
ON public.logs_painel FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS policies for logs_sistema
CREATE POLICY "Users can view their own system logs"
ON public.logs_sistema FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own system logs"
ON public.logs_sistema FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_logs_painel_user_id ON public.logs_painel(user_id);
CREATE INDEX idx_logs_painel_created_at ON public.logs_painel(created_at DESC);
CREATE INDEX idx_logs_sistema_user_id ON public.logs_sistema(user_id);
CREATE INDEX idx_logs_sistema_created_at ON public.logs_sistema(created_at DESC);