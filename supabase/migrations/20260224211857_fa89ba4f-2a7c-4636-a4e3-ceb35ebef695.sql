-- Generate invite codes for all users that have afiliados_liberado=true but no code
UPDATE afiliados_usuarios_config 
SET codigo_convite = 'AFF_' || upper(substr(md5(random()::text || id::text), 1, 10))
WHERE codigo_convite IS NULL AND afiliados_liberado = true;