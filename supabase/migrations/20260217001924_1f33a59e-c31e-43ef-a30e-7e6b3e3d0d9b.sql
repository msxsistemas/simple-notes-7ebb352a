
-- Remove Z-API config table
DROP TABLE IF EXISTS public.zapi_config;

-- Remove zapi_integration_token from system_config
ALTER TABLE public.system_config DROP COLUMN IF EXISTS zapi_integration_token;
