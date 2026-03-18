
-- Migrate all sigma-v2 panels to sigma
UPDATE paineis_integracao SET provedor = 'sigma' WHERE provedor = 'sigma-v2';

-- Migrate all products using sigma-v2 to sigma
UPDATE produtos SET provedor_iptv = 'sigma' WHERE provedor_iptv = 'sigma-v2';

-- Migrate cached sessions
UPDATE cached_panel_sessions SET provedor = 'sigma' WHERE provedor = 'sigma-v2';

-- Remove sigma-v2 from system_servidores if exists
DELETE FROM system_servidores WHERE id = 'sigma-v2';
