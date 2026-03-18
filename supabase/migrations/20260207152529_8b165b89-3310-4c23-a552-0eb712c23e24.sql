-- Alterar a tabela para usar UUID e adicionar constraint única em user_id
-- Primeiro, vamos criar uma nova sequência se não existir
DO $$
BEGIN
  -- Remover a constraint de chave primária antiga se existir dados conflitantes
  -- e adicionar uma nova coluna uuid_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mensagens_padroes' AND column_name = 'uuid_id'
  ) THEN
    ALTER TABLE public.mensagens_padroes ADD COLUMN uuid_id UUID DEFAULT gen_random_uuid();
  END IF;
END $$;

-- Adicionar constraint única em user_id para permitir upsert
ALTER TABLE public.mensagens_padroes DROP CONSTRAINT IF EXISTS mensagens_padroes_user_id_key;
ALTER TABLE public.mensagens_padroes ADD CONSTRAINT mensagens_padroes_user_id_key UNIQUE (user_id);