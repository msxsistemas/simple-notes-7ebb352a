
-- Limpar dados de usuários não-admin (manter apenas user_id = '976268dc-af38-4ec7-b87b-7fa3dcdfa896')

-- Tabelas com user_id
DELETE FROM whatsapp_messages WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM whatsapp_sessions WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM templates_mensagens WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM templates_cobranca WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM transacoes WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM notificacoes WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM notificacoes_config WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM mensagens_padroes WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM logs_painel WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM logs_sistema WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM indicacoes WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM faturas WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM cobrancas WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM cupons WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM envio_config WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM clientes WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM produtos WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM planos WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM aplicativos WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM paineis_integracao WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM asaas_config WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM ciabra_config WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM mercadopago_config WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM v3pay_config WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM checkout_config WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM user_subscriptions WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM profiles WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
DELETE FROM user_roles WHERE user_id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';

-- Remover usuários não-admin do auth.users
DELETE FROM auth.users WHERE id != '976268dc-af38-4ec7-b87b-7fa3dcdfa896';
