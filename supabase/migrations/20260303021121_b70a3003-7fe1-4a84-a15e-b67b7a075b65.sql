-- Inserir Sigma que está faltando na tabela
INSERT INTO system_servidores (id, nome, descricao, status)
VALUES ('sigma', 'SIGMA', 'Integração via API direta com painéis Sigma', 'ativo')
ON CONFLICT (id) DO UPDATE SET status = 'ativo', nome = 'SIGMA', updated_at = now();

-- Reativar KOffice API
UPDATE system_servidores SET status = 'ativo', updated_at = now() WHERE id = 'koffice-api';
