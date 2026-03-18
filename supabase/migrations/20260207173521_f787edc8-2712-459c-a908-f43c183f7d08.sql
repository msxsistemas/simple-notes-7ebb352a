-- Remover constraint que força id=1 e impede múltiplos registros
ALTER TABLE public.mensagens_padroes
  DROP CONSTRAINT IF EXISTS single_row;

-- Garantir unicidade por usuário (caso ainda não exista)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'mensagens_padroes'
      AND c.contype = 'u'
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'user_id')]
  ) THEN
    ALTER TABLE public.mensagens_padroes
      ADD CONSTRAINT mensagens_padroes_user_id_key UNIQUE (user_id);
  END IF;
END $$;
