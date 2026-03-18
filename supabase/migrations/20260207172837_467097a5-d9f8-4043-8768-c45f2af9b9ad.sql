-- Corrigir a tabela mensagens_padroes para usar sequência automática no id
-- Primeiro, remover o default de 1 e usar uma sequência

-- Criar sequência se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'mensagens_padroes_id_seq') THEN
    CREATE SEQUENCE public.mensagens_padroes_id_seq;
  END IF;
END $$;

-- Definir o próximo valor da sequência baseado no maior id existente
SELECT setval('public.mensagens_padroes_id_seq', COALESCE((SELECT MAX(id) FROM public.mensagens_padroes), 0) + 1, false);

-- Alterar a coluna id para usar a sequência ao invés do default 1
ALTER TABLE public.mensagens_padroes ALTER COLUMN id SET DEFAULT nextval('public.mensagens_padroes_id_seq');