-- Adicionar coluna para agendamento de mensagens
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE;

-- Criar índice para melhor performance nas consultas de mensagens agendadas
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_scheduled_for 
ON public.whatsapp_messages(scheduled_for) 
WHERE scheduled_for IS NOT NULL;