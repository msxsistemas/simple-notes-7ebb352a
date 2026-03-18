
-- Função para buscar segredo do vault pelo service role (sem auth.uid constraint)
-- Usada pelas edge functions que rodam com service_role_key
CREATE OR REPLACE FUNCTION public.admin_get_gateway_secret(
  p_user_id uuid,
  p_gateway text,
  p_secret_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vault_name TEXT;
  v_secret TEXT;
BEGIN
  v_vault_name := 'gw_' || p_gateway || '_' || p_secret_name || '_' || p_user_id::text;
  
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = v_vault_name;
  
  RETURN v_secret;
END;
$$;

-- Garante que apenas o service role pode chamar esta função
REVOKE ALL ON FUNCTION public.admin_get_gateway_secret(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_gateway_secret(uuid, text, text) TO service_role;
