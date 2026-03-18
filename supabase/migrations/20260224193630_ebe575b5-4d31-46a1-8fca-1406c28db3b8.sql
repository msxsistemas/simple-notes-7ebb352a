
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
  v_vault_name := 'gw_' || p_gateway || '_' || p_secret_name || '_' || p_user_id::text;
  
  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = v_vault_name;
  IF v_existing_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_existing_id;
  END IF;
  
  v_new_id := vault.create_secret(p_secret_value, v_vault_name, 'Gateway API key for ' || p_gateway);
  
  RETURN v_new_id;
END;
$function$;
