-- Add admin role verification to admin_store_gateway_secret
CREATE OR REPLACE FUNCTION public.admin_store_gateway_secret(p_user_id uuid, p_gateway text, p_secret_name text, p_secret_value text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vault_name TEXT;
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  -- Verify caller is an admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  v_vault_name := 'gw_' || p_gateway || '_' || p_secret_name || '_' || p_user_id::text;
  
  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = v_vault_name;
  IF v_existing_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_existing_id;
  END IF;
  
  v_new_id := vault.create_secret(p_secret_value, v_vault_name, 'Gateway API key for ' || p_gateway);
  
  RETURN v_new_id;
END;
$function$;

-- Add admin role verification to admin_get_gateway_secret
CREATE OR REPLACE FUNCTION public.admin_get_gateway_secret(p_user_id uuid, p_gateway text, p_secret_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vault_name TEXT;
  v_secret TEXT;
BEGIN
  -- Verify caller is an admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  v_vault_name := 'gw_' || p_gateway || '_' || p_secret_name || '_' || p_user_id::text;
  
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = v_vault_name;
  
  RETURN v_secret;
END;
$function$;