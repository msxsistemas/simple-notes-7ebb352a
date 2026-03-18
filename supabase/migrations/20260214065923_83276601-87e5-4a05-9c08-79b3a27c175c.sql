-- Ativar lembretes para o cliente Michael
UPDATE clientes SET lembretes = true WHERE id = '72c81e4e-efc6-4300-94b0-71d67fe1506d';

-- Definir lembretes como true por padrão para novos clientes
ALTER TABLE clientes ALTER COLUMN lembretes SET DEFAULT true;
