ALTER TABLE public.mensagens_padroes
ADD COLUMN IF NOT EXISTS enviar_bem_vindo boolean NOT NULL DEFAULT true;